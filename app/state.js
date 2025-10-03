export const state = {
  image: null,              // HTMLImageElement
  sourceCanvas: null,       // Offscreen canvas carrying the source pixels
  sourceCtx: null,
  sourceCommitted: null,    // Flag used by "Commit changes"
  sourceVersion: 0,         // Monotonic counter for debugging/race detection

  filterId: "",
  currentFilter: null,
  params: {},

  viewScale: 1
};

export async function initState(){
  state.viewScale = 1;
}

export function setFilterId(id){
  state.filterId = id;
}

export function setParam(filterId, key, value){
  state.params[filterId][key] = value;
}
