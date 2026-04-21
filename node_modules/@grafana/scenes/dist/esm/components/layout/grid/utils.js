import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from './constants.js';

function fitPanelsInHeight(cells, height) {
  const visibleHeight = height - GRID_CELL_VMARGIN * 4;
  const currentGridHeight = Math.max(...cells.map((cell) => cell.h + cell.y));
  const visibleGridHeight = Math.floor(visibleHeight / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN));
  const scaleFactor = currentGridHeight / visibleGridHeight;
  return cells.map((cell) => {
    return {
      ...cell,
      y: Math.round(cell.y / scaleFactor) || 0,
      h: Math.round(cell.h / scaleFactor) || 1
    };
  });
}

export { fitPanelsInHeight };
//# sourceMappingURL=utils.js.map
