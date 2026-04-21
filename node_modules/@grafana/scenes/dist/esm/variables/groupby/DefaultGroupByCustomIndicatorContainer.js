import { t } from '@grafana/i18n';
import React from 'react';
import { useTheme2, getInputStyles, IconButton, Tooltip, Icon } from '@grafana/ui';
import { isArray } from 'lodash';
import { css, cx } from '@emotion/css';

function DefaultGroupByCustomIndicatorContainer(props) {
  const { model } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);
  const inputStyles = getInputStyles({ theme, invalid: false });
  const value = isArray(model.state.value) ? model.state.value : model.state.value ? [model.state.value] : [];
  let buttons = [];
  if (value && value.length) {
    buttons.push(
      /* @__PURE__ */ React.createElement(
        IconButton,
        {
          "aria-label": t("grafana-scenes.variables.default-group-by-custom-indicator-container.aria-label-clear", "clear"),
          key: "clear",
          name: "times",
          size: "md",
          className: styles.clearIcon,
          onClick: (e) => {
            model.changeValueTo([], void 0, true);
            if (model.checkIfRestorable([])) {
              model.setState({ restorable: true });
            }
          }
        }
      )
    );
  }
  if (model.state.restorable) {
    buttons.push(
      /* @__PURE__ */ React.createElement(
        IconButton,
        {
          onClick: (e) => {
            props.model.restoreDefaultValues();
          },
          onKeyDownCapture: (e) => {
            if (e.key === "Enter") {
              props.model.restoreDefaultValues();
            }
          },
          key: "restore",
          name: "history",
          size: "md",
          className: styles.clearIcon,
          tooltip: t(
            "grafana-scenes.variables.default-group-by-custom-indicator-container.tooltip-restore-groupby-set-by-this-dashboard",
            "Restore groupby set by this dashboard."
          )
        }
      )
    );
  }
  if (!model.state.restorable) {
    buttons.push(
      /* @__PURE__ */ React.createElement(
        Tooltip,
        {
          key: "tooltip",
          content: t(
            "grafana-scenes.variables.default-group-by-custom-indicator-container.tooltip",
            "Applied by default in this dashboard. If edited, it carries over to other dashboards."
          ),
          placement: "bottom"
        },
        /* @__PURE__ */ React.createElement(Icon, { name: "info-circle", size: "md" })
      )
    );
  }
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      onMouseDown: (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      className: cx(
        inputStyles.suffix,
        css({
          position: "relative"
        })
      )
    },
    buttons
  );
}
const getStyles = (theme) => ({
  clearIcon: css({
    color: theme.colors.action.disabledText,
    cursor: "pointer",
    "&:hover:before": {
      backgroundColor: "transparent"
    },
    "&:hover": {
      color: theme.colors.text.primary
    }
  })
});

export { DefaultGroupByCustomIndicatorContainer };
//# sourceMappingURL=DefaultGroupByCustomIndicatorContainer.js.map
