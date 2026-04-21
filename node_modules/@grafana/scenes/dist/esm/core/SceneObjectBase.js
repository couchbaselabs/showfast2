import { useState, useEffect } from 'react';
import { Subscription } from 'rxjs';
import { v4 } from 'uuid';
import { EventBusSrv } from '@grafana/data';
import { SceneComponentWrapper } from './SceneComponentWrapper.js';
import { SceneObjectStateChangedEvent } from './events.js';
import { cloneSceneObject } from './sceneGraph/cloneSceneObject.js';
import { SceneObjectRef } from './SceneObjectRef.js';

class SceneObjectBase {
  constructor(state) {
    this._isActive = false;
    this._activationHandlers = [];
    this._deactivationHandlers = /* @__PURE__ */ new Map();
    this._subs = new Subscription();
    this._refCount = 0;
    this._renderBeforeActivation = false;
    if (!state.key) {
      state.key = v4();
    }
    this._events = new EventBusSrv();
    this._state = Object.freeze(state);
    this._setParent(this._state);
  }
  /** Current state */
  get state() {
    return this._state;
  }
  /** True if currently being active (ie displayed for visual objects) */
  get isActive() {
    return this._isActive;
  }
  get renderBeforeActivation() {
    return this._renderBeforeActivation;
  }
  /** Returns the parent, undefined for root object */
  get parent() {
    return this._parent;
  }
  /** Returns variable dependency config */
  get variableDependency() {
    return this._variableDependency;
  }
  /** Returns url sync config */
  get urlSync() {
    return this._urlSync;
  }
  /**
   * Used in render functions when rendering a SceneObject.
   * Wraps the component in an EditWrapper that handles edit mode
   */
  get Component() {
    return SceneComponentWrapper;
  }
  _setParent(state) {
    forEachChild(state, (child) => {
      if (child._parent && child._parent !== this) {
        console.warn(
          "SceneObject already has a parent set that is different from the new parent. You cannot share the same SceneObject instance in multiple scenes or in multiple different places of the same scene graph. Use SceneObject.clone() to duplicate a SceneObject or store a state key reference and use sceneGraph.findObject to locate it.",
          child,
          this
        );
      }
      child._parent = this;
    });
  }
  /**
   * Sometimes you want to move one instance to another parent.
   * This is a way to do that without getting the console warning.
   */
  clearParent() {
    this._parent = void 0;
  }
  /**
   * Subscribe to the scene state subject
   **/
  subscribeToState(handler) {
    return this._events.subscribe(SceneObjectStateChangedEvent, (event) => {
      if (event.payload.changedObject === this) {
        handler(event.payload.newState, event.payload.prevState);
      }
    });
  }
  /**
   * Subscribe to the scene event
   **/
  subscribeToEvent(eventType, handler) {
    return this._events.subscribe(eventType, handler);
  }
  setState(update) {
    const prevState = this._state;
    const newState = {
      ...this._state,
      ...update
    };
    this._state = Object.freeze(newState);
    this._setParent(update);
    this._handleActivationOfChangedStateProps(prevState, newState);
    this.publishEvent(
      new SceneObjectStateChangedEvent({
        prevState,
        newState,
        partialUpdate: update,
        changedObject: this
      }),
      true
    );
  }
  /**
   * This handles activation and deactivation of $data, $timeRange and $variables when they change
   * during the active phase of the scene object.
   */
  _handleActivationOfChangedStateProps(prevState, newState) {
    if (!this.isActive) {
      return;
    }
    if (prevState.$behaviors !== newState.$behaviors) {
      this._handleChangedBehaviors(prevState.$behaviors, newState.$behaviors);
    }
    if (prevState.$data !== newState.$data) {
      this._handleChangedStateActivation(prevState.$data, newState.$data);
    }
    if (prevState.$variables !== newState.$variables) {
      this._handleChangedStateActivation(prevState.$variables, newState.$variables);
    }
    if (prevState.$timeRange !== newState.$timeRange) {
      this._handleChangedStateActivation(prevState.$timeRange, newState.$timeRange);
    }
  }
  _handleChangedStateActivation(oldValue, newValue) {
    if (oldValue) {
      const deactivationHandler = this._deactivationHandlers.get(oldValue);
      if (deactivationHandler) {
        deactivationHandler();
        this._deactivationHandlers.delete(oldValue);
      }
    }
    if (newValue) {
      this._deactivationHandlers.set(newValue, newValue.activate());
    }
  }
  _handleChangedBehaviors(oldValue, newValue) {
    if (oldValue) {
      for (const oldBehavior of oldValue) {
        if (!newValue || !newValue.includes(oldBehavior)) {
          const deactivationHandler = this._deactivationHandlers.get(oldBehavior);
          if (deactivationHandler) {
            deactivationHandler();
            this._deactivationHandlers.delete(oldBehavior);
          }
        }
      }
    }
    if (newValue) {
      for (const newBehavior of newValue) {
        if (!oldValue || !oldValue.includes(newBehavior)) {
          this._activateBehavior(newBehavior);
        }
      }
    }
  }
  /*
   * Publish an event and optionally bubble it up the scene
   **/
  publishEvent(event, bubble) {
    this._events.publish(event);
    if (bubble && this.parent) {
      this.parent.publishEvent(event, bubble);
    }
  }
  getRoot() {
    return !this._parent ? this : this._parent.getRoot();
  }
  _internalActivate() {
    this._isActive = true;
    const { $data, $variables, $timeRange, $behaviors } = this.state;
    this._activationHandlers.forEach((handler) => {
      const result = handler();
      if (result) {
        this._deactivationHandlers.set(result, result);
      }
    });
    if ($timeRange && !$timeRange.isActive) {
      this._deactivationHandlers.set($timeRange, $timeRange.activate());
    }
    if ($variables && !$variables.isActive) {
      this._deactivationHandlers.set($variables, $variables.activate());
    }
    if ($data && !$data.isActive) {
      this._deactivationHandlers.set($data, $data.activate());
    }
    if ($behaviors) {
      for (const behavior of $behaviors) {
        this._activateBehavior(behavior);
      }
    }
  }
  _activateBehavior(behavior) {
    if (behavior instanceof SceneObjectBase) {
      this._deactivationHandlers.set(behavior, behavior.activate());
    } else if (typeof behavior === "function") {
      const deactivate = behavior(this);
      if (deactivate) {
        this._deactivationHandlers.set(behavior, deactivate);
      }
    }
  }
  /**
   * This is primarily called from SceneComponentWrapper when the SceneObject's Component is mounted.
   * But in some scenarios this can also be called directly from another scene object. When called manually from another scene object
   * make sure to call the returned function when the source scene object is deactivated.
   */
  activate() {
    if (!this.isActive) {
      this._internalActivate();
    }
    this._refCount++;
    let called = false;
    return () => {
      this._refCount--;
      if (called) {
        const msg = `SceneObject cancelation handler returned by activate() called a second time`;
        throw new Error(msg);
      }
      called = true;
      if (this._refCount === 0) {
        this._internalDeactivate();
      }
    };
  }
  /**
   * Called by the SceneComponentWrapper when the react component is unmounted.
   * Don't override this, instead use addActivationHandler. The activation handler can return a deactivation handler.
   */
  _internalDeactivate() {
    this._isActive = false;
    for (let handler of this._deactivationHandlers.values()) {
      handler();
    }
    this._deactivationHandlers.clear();
    this._events.removeAllListeners();
    this._subs.unsubscribe();
    this._subs = new Subscription();
  }
  /**
   * Utility hook to get and subscribe to state
   */
  useState() {
    return useSceneObjectState(this);
  }
  /** Force a re-render, should only be needed when variable values change */
  forceRender() {
    this.setState({});
  }
  /**
   * Will create new SceneObject with shallow-cloned state, but all state items of type SceneObject are deep cloned
   */
  clone(withState) {
    return cloneSceneObject(this, withState);
  }
  /**
   * Allows external code to register code that is executed on activate and deactivate. This allow you
   * to wire up scene objects that need to respond to state changes in other objects from the outside.
   **/
  addActivationHandler(handler) {
    this._activationHandlers.push(handler);
  }
  /**
   * Loop through state and call callback for each direct child scene object.
   * Checks 1 level deep properties and arrays. So a scene object hidden in a nested plain object will not be detected.
   * Return false to exit loop early.
   */
  forEachChild(callback) {
    forEachChild(this.state, callback);
  }
  /** Returns a SceneObjectRef that will resolve to this object */
  getRef() {
    if (!this._ref) {
      this._ref = new SceneObjectRef(this);
    }
    return this._ref;
  }
  toJSON() {
    return {
      type: Object.getPrototypeOf(this).constructor.name,
      isActive: this.isActive,
      state: this.state
    };
  }
}
function useSceneObjectState(model, options) {
  var _a;
  const [_, setState] = useState(model.state);
  const stateAtFirstRender = model.state;
  const shouldActivateOrKeepAlive = (_a = options == null ? void 0 : options.shouldActivateOrKeepAlive) != null ? _a : false;
  useEffect(() => {
    let unactivate;
    if (shouldActivateOrKeepAlive) {
      unactivate = model.activate();
    }
    const s = model.subscribeToState((state) => {
      setState(state);
    });
    if (model.state !== stateAtFirstRender) {
      setState(model.state);
    }
    return () => {
      s.unsubscribe();
      if (unactivate) {
        unactivate();
      }
    };
  }, [model, shouldActivateOrKeepAlive]);
  return model.state;
}
function forEachChild(state, callback) {
  for (const propValue of Object.values(state)) {
    if (propValue instanceof SceneObjectBase) {
      const result = callback(propValue);
      if (result === false) {
        break;
      }
    }
    if (Array.isArray(propValue)) {
      let exitEarly = false;
      for (const child of propValue) {
        if (child instanceof SceneObjectBase) {
          const result = callback(child);
          if (result === false) {
            exitEarly = true;
            break;
          }
        }
      }
      if (exitEarly) {
        break;
      }
    }
  }
}

export { SceneObjectBase, useSceneObjectState };
//# sourceMappingURL=SceneObjectBase.js.map
