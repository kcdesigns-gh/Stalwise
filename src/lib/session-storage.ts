// Web: use the browser's own localStorage (absent while the page is pre-rendered).
export const sessionStorage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage;
