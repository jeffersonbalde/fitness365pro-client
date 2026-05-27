export const getAuthHeroStyle = (bgImage, isDark, { minHeight = '100vh' } = {}) => ({
  backgroundImage: isDark
    ? `linear-gradient(rgba(6, 34, 86, 0.35), rgba(6, 34, 86, 0.35)), url(${bgImage})`
    : `linear-gradient(rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.32)), url(${bgImage})`,
  backgroundSize: 'cover',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center 30%',
  minHeight,
})
