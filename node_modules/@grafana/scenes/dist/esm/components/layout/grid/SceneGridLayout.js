import { SceneObjectBase } from '../../../core/SceneObjectBase.js';
import { DEFAULT_PANEL_SPAN } from './constants.js';
import { isSceneGridRow } from './SceneGridItem.js';
import { SceneGridLayoutRenderer } from './SceneGridLayoutRenderer.js';
import { SceneGridRow } from './SceneGridRow.js';
import { SceneGridLayoutDragStartEvent } from './types.js';
import { fitPanelsInHeight } from './utils.js';
import { isRepeatCloneOrChildOf } from '../../../utils/utils.js';

const _SceneGridLayout = class _SceneGridLayout extends SceneObjectBase {
  constructor(state) {
    super({
      ...state,
      children: sortChildrenByPosition(state.children)
    });
    this._skipOnLayoutChange = false;
    this._oldLayout = [];
    this._loadOldLayout = false;
    this.onLayoutChange = (layout) => {
      if (this._skipOnLayoutChange) {
        this._skipOnLayoutChange = false;
        return;
      }
      if (this._loadOldLayout) {
        layout = [...this._oldLayout];
        this._loadOldLayout = false;
      }
      for (const item of layout) {
        const child = this.getSceneLayoutChild(item.i);
        const nextSize = {
          x: item.x,
          y: item.y,
          width: item.w,
          height: item.h
        };
        if (!isItemSizeEqual(child.state, nextSize)) {
          child.setState({
            ...nextSize
          });
        }
      }
      this.setState({ children: sortChildrenByPosition(this.state.children) });
    };
    this.onResizeStop = (_, o, n) => {
      const child = this.getSceneLayoutChild(n.i);
      child.setState({
        width: n.w,
        height: n.h
      });
    };
    this.onDragStart = (gridLayout) => {
      this._oldLayout = [...gridLayout];
    };
    this.onDragStop = (gridLayout, o, updatedItem) => {
      const sceneChild = this.getSceneLayoutChild(updatedItem.i);
      gridLayout = sortGridLayout(gridLayout);
      const indexOfUpdatedItem = gridLayout.findIndex((item) => item.i === updatedItem.i);
      let newParent = this.findGridItemSceneParent(gridLayout, indexOfUpdatedItem - 1);
      let newChildren = this.state.children;
      for (let i = 0; i < gridLayout.length; i++) {
        const gridItem = gridLayout[i];
        const child = this.getSceneLayoutChild(gridItem.i);
        const childSize = child.state;
        if ((childSize == null ? void 0 : childSize.x) !== gridItem.x || (childSize == null ? void 0 : childSize.y) !== gridItem.y) {
          child.setState({
            x: gridItem.x,
            y: gridItem.y
          });
        }
      }
      if (newParent instanceof SceneGridRow && isRepeatCloneOrChildOf(newParent)) {
        this._loadOldLayout = true;
      }
      if (sceneChild instanceof SceneGridRow && newParent instanceof SceneGridRow) {
        if (!this.isRowDropValid(gridLayout, updatedItem, indexOfUpdatedItem)) {
          this._loadOldLayout = true;
        }
        newParent = this;
      }
      if (newParent !== sceneChild.parent && !this._loadOldLayout) {
        newChildren = this.moveChildTo(sceneChild, newParent);
      }
      this.setState({ children: sortChildrenByPosition(newChildren) });
      this._skipOnLayoutChange = true;
    };
  }
  /**
   * SceneLayout interface. Used for example by VizPanelRenderer
   */
  isDraggable() {
    var _a;
    return (_a = this.state.isDraggable) != null ? _a : false;
  }
  getDragClass() {
    return `grid-drag-handle-${this.state.key}`;
  }
  getDragClassCancel() {
    return `grid-drag-cancel`;
  }
  getDragHooks() {
    return {
      onDragStart: (evt, panel) => {
        this.publishEvent(new SceneGridLayoutDragStartEvent({ evt, panel }), true);
      }
    };
  }
  adjustYPositions(after, amount) {
    for (const child of this.state.children) {
      if (child.state.y > after) {
        child.setState({ y: child.state.y + amount });
      }
      if (child instanceof SceneGridRow) {
        for (const rowChild of child.state.children) {
          if (rowChild.state.y > after) {
            rowChild.setState({ y: rowChild.state.y + amount });
          }
        }
      }
    }
  }
  toggleRow(row) {
    var _a, _b;
    const isCollapsed = row.state.isCollapsed;
    if (!isCollapsed) {
      row.setState({ isCollapsed: true });
      this.setState({});
      return;
    }
    const rowChildren = row.state.children;
    if (rowChildren.length === 0) {
      row.setState({ isCollapsed: false });
      this.setState({});
      return;
    }
    const rowY = row.state.y;
    const firstPanelYPos = (_a = rowChildren[0].state.y) != null ? _a : rowY;
    const yDiff = firstPanelYPos - (rowY + 1);
    let yMax = rowY;
    for (const panel of rowChildren) {
      const newSize = { ...panel.state };
      newSize.y = (_b = newSize.y) != null ? _b : rowY;
      newSize.y -= yDiff;
      if (newSize.y !== panel.state.y) {
        panel.setState(newSize);
      }
      yMax = Math.max(yMax, Number(newSize.y) + Number(newSize.height));
    }
    const pushDownAmount = yMax - rowY - 1;
    for (const child of this.state.children) {
      if (child.state.y > rowY) {
        this.pushChildDown(child, pushDownAmount);
      }
      if (isSceneGridRow(child) && child !== row) {
        for (const rowChild of child.state.children) {
          if (rowChild.state.y > rowY) {
            this.pushChildDown(rowChild, pushDownAmount);
          }
        }
      }
    }
    row.setState({ isCollapsed: false });
    this.setState({});
  }
  ignoreLayoutChange(shouldIgnore) {
    this._skipOnLayoutChange = shouldIgnore;
  }
  /**
   * Will also scan row children and return child of the row
   */
  getSceneLayoutChild(key) {
    for (const child of this.state.children) {
      if (child.state.key === key) {
        return child;
      }
      if (child instanceof SceneGridRow) {
        for (const rowChild of child.state.children) {
          if (rowChild.state.key === key) {
            return rowChild;
          }
        }
      }
    }
    throw new Error("Scene layout child not found for GridItem");
  }
  pushChildDown(child, amount) {
    child.setState({
      y: child.state.y + amount
    });
  }
  /**
   *  We assume the layout array is sorted according to y pos, and walk upwards until we find a row.
   *  If it is collapsed there is no row to add it to. The default is then to return the SceneGridLayout itself
   */
  findGridItemSceneParent(layout, startAt) {
    for (let i = startAt; i >= 0; i--) {
      const gridItem = layout[i];
      const sceneChild = this.getSceneLayoutChild(gridItem.i);
      if (sceneChild instanceof SceneGridRow) {
        if (sceneChild.state.isCollapsed) {
          return this;
        }
        return sceneChild;
      }
    }
    return this;
  }
  /**
   * Helper func to check if we are dropping a row in between panels of another row
   */
  isRowDropValid(gridLayout, updatedItem, indexOfUpdatedItem) {
    if (gridLayout[gridLayout.length - 1].i === updatedItem.i) {
      return true;
    }
    const nextSceneChild = this.getSceneLayoutChild(gridLayout[indexOfUpdatedItem + 1].i);
    if (nextSceneChild instanceof SceneGridRow) {
      return true;
    } else if (nextSceneChild.parent instanceof _SceneGridLayout) {
      return true;
    }
    return false;
  }
  /**
   * This likely needs a slightly different approach. Where we clone or deactivate or and re-activate the moved child
   */
  moveChildTo(child, target) {
    const currentParent = child.parent;
    let rootChildren = this.state.children;
    const newChild = child.clone({ key: child.state.key });
    if (currentParent instanceof SceneGridRow) {
      const newRow = currentParent.clone();
      newRow.setState({
        children: newRow.state.children.filter((c) => c.state.key !== child.state.key)
      });
      rootChildren = rootChildren.map((c) => c === currentParent ? newRow : c);
      if (target instanceof SceneGridRow) {
        const targetRow = target.clone();
        targetRow.setState({ children: [...targetRow.state.children, newChild] });
        rootChildren = rootChildren.map((c) => c === target ? targetRow : c);
      } else {
        rootChildren = [...rootChildren, newChild];
      }
    } else {
      if (!(target instanceof _SceneGridLayout)) {
        rootChildren = rootChildren.filter((c) => c.state.key !== child.state.key);
        const targetRow = target.clone();
        targetRow.setState({ children: [...targetRow.state.children, newChild] });
        rootChildren = rootChildren.map((c) => c === target ? targetRow : c);
      }
    }
    return rootChildren;
  }
  toGridCell(child) {
    const size = child.state;
    let x = Number.isFinite(Number(size.x)) ? Number(size.x) : 0;
    let y = Number.isFinite(Number(size.y)) ? Number(size.y) : 0;
    const w = Number.isFinite(Number(size.width)) ? Number(size.width) : DEFAULT_PANEL_SPAN;
    const h = Number.isFinite(Number(size.height)) ? Number(size.height) : DEFAULT_PANEL_SPAN;
    let isDraggable = child.state.isDraggable;
    let isResizable = child.state.isResizable;
    if (child instanceof SceneGridRow) {
      isDraggable = child.state.isCollapsed ? true : false;
      isResizable = false;
    }
    if (isRepeatCloneOrChildOf(child)) {
      isDraggable = false;
      isResizable = false;
    }
    return { i: child.state.key, x, y, h, w, isResizable, isDraggable };
  }
  buildGridLayout(width, height) {
    let cells = [];
    for (const child of this.state.children) {
      cells.push(this.toGridCell(child));
      if (child instanceof SceneGridRow && !child.state.isCollapsed) {
        for (const rowChild of child.state.children) {
          cells.push(this.toGridCell(rowChild));
        }
      }
    }
    cells = sortGridLayout(cells);
    if (this.state.UNSAFE_fitPanels) {
      cells = fitPanelsInHeight(cells, height);
    }
    if (width < 768) {
      this._skipOnLayoutChange = true;
      return cells.map((cell) => ({ ...cell, w: 24 }));
    }
    this._skipOnLayoutChange = false;
    return cells;
  }
};
_SceneGridLayout.Component = SceneGridLayoutRenderer;
let SceneGridLayout = _SceneGridLayout;
function isItemSizeEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
function sortChildrenByPosition(children) {
  children.forEach((child) => {
    if (child instanceof SceneGridRow) {
      child.setState({ children: sortChildrenByPosition(child.state.children) });
    }
  });
  return [...children].sort((a, b) => {
    return a.state.y - b.state.y || a.state.x - b.state.x;
  });
}
function sortGridLayout(layout) {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
}

export { SceneGridLayout };
//# sourceMappingURL=SceneGridLayout.js.map
