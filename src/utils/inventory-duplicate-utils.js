export const normalizeDuplicateText = (value, aggressive = false) => {
  const base = String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  if (!aggressive) return base

  // Ignore punctuation/symbol/spacing differences for duplicate detection.
  return base.replace(/[^a-z0-9]/g, "")
}

export const buildInventoryDuplicateKey = (item) => {
  const nameKey = normalizeDuplicateText(item?.item_name, true)
  const brandKey = normalizeDuplicateText(item?.brand, true)

  if (!nameKey) return ""
  return `${nameKey}|${brandKey || "_"}`
}

export const findInventoryDuplicateItem = (items = [], candidate = {}) => {
  const candidateKey = buildInventoryDuplicateKey(candidate)
  if (!candidateKey) return null

  return (
    items.find((item) => buildInventoryDuplicateKey(item) === candidateKey) ||
    null
  )
}
