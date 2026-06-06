/** Frontend types mirroring pkg/models/menu.go */

export interface CategoryDef {
  id: string;
  title: string;
  subCategories: string[];
}

export interface ComponentDef {
  id: string;
  title: string;
  categories: CategoryDef[];
}

export interface MenuVariant {
  id: string;
  label: string;
  components: ComponentDef[];
}

export interface MenuConfig {
  variants: MenuVariant[];
}
