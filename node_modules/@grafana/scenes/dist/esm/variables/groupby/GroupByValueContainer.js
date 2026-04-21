import React from 'react';
import { useTheme2, getSelectStyles } from '@grafana/ui';
import { cx } from '@emotion/css';
import { getNonApplicablePillStyles } from '../utils.js';

const GroupByValueContainer = ({
  keysApplicability,
  children
}) => {
  var _a, _b;
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const { disabledPill, strikethrough } = getNonApplicablePillStyles(theme);
  const firstChild = React.Children.toArray(children)[0];
  let isApplicable = true;
  if (React.isValidElement(firstChild) && ((_b = (_a = firstChild.props) == null ? void 0 : _a.data) == null ? void 0 : _b.value)) {
    const value = firstChild.props.data.value;
    const applicability = keysApplicability == null ? void 0 : keysApplicability.find((item) => item.key === value);
    if (applicability && !applicability.applicable) {
      isApplicable = false;
    }
  }
  return /* @__PURE__ */ React.createElement("div", { className: cx(styles.multiValueContainer, !isApplicable && cx(disabledPill, strikethrough)) }, children);
};

export { GroupByValueContainer };
//# sourceMappingURL=GroupByValueContainer.js.map
