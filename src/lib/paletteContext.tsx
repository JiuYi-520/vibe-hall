import { createContext, useContext } from 'react'

interface PaletteApi {
  open: () => void
  close: () => void
  isOpen: boolean
}

export const PaletteContext = createContext<PaletteApi>({ open: () => {}, close: () => {}, isOpen: false })

export function usePalette(): PaletteApi {
  return useContext(PaletteContext)
}
