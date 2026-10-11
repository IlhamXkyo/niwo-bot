/**
 * botmode.js
 * Defines which plugin categories are visible per bot "mode". Read by
 * plugins/main/menu.js to filter/exclude categories from the menu.
 *
 * Edit MODES to match whatever categories you actually use in /plugins.
 */

const MODES = {
  md: {
    allowedCategories: null, // null = semua kategori boleh
    excludeCategories: ["panel", "pushkontak", "store"],
  },
  cpanel: {
    allowedCategories: ["owner", "tools"],
    excludeCategories: null,
  },
  store: {
    allowedCategories: ["store", "main"],
    excludeCategories: null,
  },
  pushkontak: {
    allowedCategories: ["owner"],
    excludeCategories: null,
  },
};

export { MODES };
