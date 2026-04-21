import React, { useState, useRef, useImperativeHandle } from 'react';
import { useEffectOnce } from 'react-use';
import { uniqueId } from 'lodash';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { t } from '@grafana/i18n';

function useUniqueId() {
  var _a;
  const idRefLazy = useRef(void 0);
  (_a = idRefLazy.current) != null ? _a : idRefLazy.current = uniqueId();
  return idRefLazy.current;
}
const LazyLoader = React.forwardRef(
  ({ children, onLoad, onChange, className, ...rest }, ref) => {
    const id = useUniqueId();
    const { hideEmpty } = useStyles2(getStyles);
    const [loaded, setLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    useEffectOnce(() => {
      LazyLoader.addCallback(id, (entry) => {
        if (!loaded && entry.isIntersecting) {
          setLoaded(true);
          onLoad == null ? void 0 : onLoad();
        }
        setIsInView(entry.isIntersecting);
        onChange == null ? void 0 : onChange(entry.isIntersecting);
      });
      const wrapperEl = innerRef.current;
      if (wrapperEl) {
        LazyLoader.observer.observe(wrapperEl);
      }
      return () => {
        wrapperEl && LazyLoader.observer.unobserve(wrapperEl);
        delete LazyLoader.callbacks[id];
        if (Object.keys(LazyLoader.callbacks).length === 0) {
          LazyLoader.observer.disconnect();
        }
      };
    });
    return /* @__PURE__ */ React.createElement("div", { id, ref: innerRef, className: `${hideEmpty} ${className}`, ...rest }, !loaded ? t("grafana-scenes.components.lazy-loader.placeholder", "\xA0") : /* @__PURE__ */ React.createElement(LazyLoaderInViewContext.Provider, { value: isInView }, children));
  }
);
function getStyles() {
  return {
    hideEmpty: css({
      "&:empty": {
        display: "none"
      }
    })
  };
}
LazyLoader.displayName = "LazyLoader";
LazyLoader.callbacks = {};
LazyLoader.addCallback = (id, c) => LazyLoader.callbacks[id] = c;
LazyLoader.observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (typeof LazyLoader.callbacks[entry.target.id] === "function") {
        LazyLoader.callbacks[entry.target.id](entry);
      }
    }
  },
  { rootMargin: "100px" }
);
const LazyLoaderInViewContext = React.createContext(true);
function useLazyLoaderIsInView() {
  return React.useContext(LazyLoaderInViewContext);
}

export { LazyLoader, LazyLoaderInViewContext, useLazyLoaderIsInView, useUniqueId };
//# sourceMappingURL=LazyLoader.js.map
