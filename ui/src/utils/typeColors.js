export const typeColors = {
  int: '#58a6ff',
  str: '#3fb950',
  float: '#d29922',
  bool: '#a371f7',
  list: '#e3b341',
  dict: '#39d353',
  Any: '#8b949e'
}

export function getTypeColor(typeName) {
  return typeColors[typeName] || typeColors.Any
}

export function getTypeClass(typeName) {
  return `type-${typeName.toLowerCase()}`
}

