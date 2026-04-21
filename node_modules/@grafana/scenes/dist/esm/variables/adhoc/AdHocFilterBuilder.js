import { t } from '@grafana/i18n';
import React from 'react';
import { AdHocFilterRenderer } from './AdHocFilterRenderer.js';
import { useStyles2, Button } from '@grafana/ui';
import { css } from '@emotion/css';

function AdHocFilterBuilder({ model, addFilterButtonText }) {
  const { _wip } = model.useState();
  const styles = useStyles2(getStyles);
  if (!_wip) {
    return /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "secondary",
        icon: "plus",
        title: t("grafana-scenes.variables.ad-hoc-filter-builder.title-add-filter", "Add filter"),
        "aria-label": t("grafana-scenes.variables.ad-hoc-filter-builder.aria-label-add-filter", "Add filter"),
        "data-testid": `AdHocFilter-add`,
        onClick: () => model._addWip(),
        className: styles.addButton
      },
      addFilterButtonText
    );
  }
  return /* @__PURE__ */ React.createElement(AdHocFilterRenderer, { filter: _wip, model });
}
const getStyles = (theme) => ({
  addButton: css({
    "&:first-child": {
      borderBottomLeftRadius: 0,
      borderTopLeftRadius: 0
    }
  })
});

export { AdHocFilterBuilder };
//# sourceMappingURL=AdHocFilterBuilder.js.map
