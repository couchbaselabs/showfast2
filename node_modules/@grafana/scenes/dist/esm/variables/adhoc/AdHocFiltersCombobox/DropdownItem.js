import { Trans } from '@grafana/i18n';
import { css, cx } from '@emotion/css';
import { useStyles2, Checkbox, Button } from '@grafana/ui';
import React, { forwardRef, useId } from 'react';

const DropdownItem = forwardRef(
  function DropdownItem2({ children, active, addGroupBottomBorder, isMultiValueEdit, checked, ...rest }, ref) {
    const styles = useStyles2(getStyles);
    const id = useId();
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        ref,
        role: "option",
        id,
        "aria-selected": active,
        className: cx(styles.option, active && styles.optionFocused, addGroupBottomBorder && styles.groupBottomBorder),
        ...rest
      },
      /* @__PURE__ */ React.createElement("div", { className: styles.optionBody, "data-testid": `data-testid ad hoc filter option value ${children}` }, /* @__PURE__ */ React.createElement("span", null, isMultiValueEdit ? /* @__PURE__ */ React.createElement(Checkbox, { tabIndex: -1, checked, className: styles.checkbox }) : null, children))
    );
  }
);
const getStyles = (theme) => ({
  option: css({
    label: "grafana-select-option",
    top: 0,
    left: 0,
    width: "100%",
    position: "absolute",
    padding: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    whiteSpace: "nowrap",
    cursor: "pointer",
    "&:hover": {
      background: theme.colors.action.hover,
      "@media (forced-colors: active), (prefers-contrast: more)": {
        border: `1px solid ${theme.colors.primary.border}`
      }
    }
  }),
  optionFocused: css({
    label: "grafana-select-option-focused",
    background: theme.colors.action.focus,
    "@media (forced-colors: active), (prefers-contrast: more)": {
      border: `1px solid ${theme.colors.primary.border}`
    }
  }),
  optionBody: css({
    label: "grafana-select-option-body",
    display: "flex",
    fontWeight: theme.typography.fontWeightMedium,
    flexDirection: "column",
    flexGrow: 1
  }),
  groupBottomBorder: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`
  }),
  checkbox: css({
    paddingRight: theme.spacing(0.5)
  }),
  multiValueApplyWrapper: css({
    position: "fixed",
    top: 0,
    left: 0,
    display: "flex",
    backgroundColor: theme.colors.background.primary,
    color: theme.colors.text.primary,
    boxShadow: theme.shadows.z2,
    overflowY: "auto",
    zIndex: theme.zIndex.dropdown,
    gap: theme.spacing(1.5),
    padding: `${theme.spacing(1.5)} ${theme.spacing(1)}`
  })
});
const LoadingOptionsPlaceholder = () => {
  return /* @__PURE__ */ React.createElement(DropdownItem, { onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement(Trans, { i18nKey: "grafana-scenes.variables.loading-options-placeholder.loading-options" }, "Loading options..."));
};
const NoOptionsPlaceholder = () => {
  return /* @__PURE__ */ React.createElement(DropdownItem, { onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement(Trans, { i18nKey: "grafana-scenes.variables.no-options-placeholder.no-options-found" }, "No options found"));
};
const OptionsErrorPlaceholder = ({ handleFetchOptions }) => {
  return /* @__PURE__ */ React.createElement(DropdownItem, { onClick: handleFetchOptions }, /* @__PURE__ */ React.createElement(Trans, { i18nKey: "grafana-scenes.variables.options-error-placeholder.error-occurred-fetching-labels-click-retry" }, "An error has occurred fetching labels. Click to retry"));
};
const MultiValueApplyButton = ({
  onApply,
  floatingElement,
  maxOptionWidth,
  menuHeight
}) => {
  const styles = useStyles2(getStyles);
  const floatingElementRect = floatingElement == null ? void 0 : floatingElement.getBoundingClientRect();
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: styles.multiValueApplyWrapper,
      style: {
        width: `${maxOptionWidth}px`,
        transform: `translate(${floatingElementRect == null ? void 0 : floatingElementRect.left}px,${floatingElementRect ? floatingElementRect.top + menuHeight : 0}px)`
      }
    },
    /* @__PURE__ */ React.createElement(Button, { onClick: onApply, size: "sm", tabIndex: -1 }, /* @__PURE__ */ React.createElement(Trans, { i18nKey: "grafana-scenes.variables.multi-value-apply-button.apply" }, "Apply"))
  );
};

export { DropdownItem, LoadingOptionsPlaceholder, MultiValueApplyButton, NoOptionsPlaceholder, OptionsErrorPlaceholder };
//# sourceMappingURL=DropdownItem.js.map
