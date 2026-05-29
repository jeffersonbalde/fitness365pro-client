export const feetInchesToCm = (feet, inches) => {
  const ft = parseInt(feet, 10) || 0
  const inc = parseInt(inches, 10) || 0
  return Math.round((ft * 12 + inc) * 2.54)
}

export const cmToFeetInches = (cm) => {
  if (cm == null || cm === '' || Number.isNaN(Number(cm))) {
    return { feet: '', inches: '' }
  }

  const totalInches = Math.round(Number(cm) / 2.54)
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12

  return { feet: String(feet), inches: String(inches) }
}

export const formatHeightFtIn = (cm) => {
  if (cm == null || cm === '') return null

  const { feet, inches } = cmToFeetInches(cm)
  if (!feet) return null

  return `${feet}' ${inches}"`
}

export const validateHeightFeetInches = (feet, inches, { required = true } = {}) => {
  if (feet === '' && inches === '') {
    return required ? 'Height is required' : null
  }

  const ft = parseInt(feet, 10)
  const inc = inches === '' ? 0 : parseInt(inches, 10)

  if (Number.isNaN(ft) || ft < 1 || ft > 9) {
    return 'Enter a valid height in feet (1–9)'
  }
  if (Number.isNaN(inc) || inc < 0 || inc > 11) {
    return 'Inches must be between 0 and 11'
  }

  const cm = feetInchesToCm(ft, inc)
  if (cm < 50 || cm > 300) {
    return 'Height must be between 1\'8" and 9\'10"'
  }

  return null
}
