import { t } from '@grafana/i18n';
import { Tooltip, Icon } from '@grafana/ui';
import React from 'react';

function LoadingIndicator(props) {
  return /* @__PURE__ */ React.createElement(Tooltip, { content: t("grafana-scenes.utils.loading-indicator.content-cancel-query", "Cancel query") }, /* @__PURE__ */ React.createElement(
    Icon,
    {
      className: "spin-clockwise",
      name: "sync",
      size: "xs",
      role: "button",
      onMouseDown: (e) => {
        props.onCancel(e);
      }
    }
  ));
}

export { LoadingIndicator };
//# sourceMappingURL=LoadingIndicator.js.map
