// executed inside sandboxed browser environment,
// no access to scrope outside of function
export default function getUsedFonts () {
  console.log('debug: getUsedFonts init')
  var h = window.innerHeight

  function isElementAboveFold (element) {
    // temporarily force clear none in order to catch elements that clear previous
    // content themselves and who w/o their styles could show up unstyled in above
    // the fold content (if they rely on f.e. 'clear:both;' to clear some main content)

    // but do that only if elements have their style attribute defined
    // (ref: https://github.com/pocketjoso/penthouse/issues/342)
    const isElementStyleDefined = typeof element.style !== 'undefined'
    if (isElementStyleDefined) {
      var originalClearStyle = element.style.clear || ''
      element.style.clear = 'none'
    }

    var aboveFold = element.getBoundingClientRect().top < h
    // cache so we dont have to re-query DOM for this value

    if (isElementStyleDefined) {
      // set clear style back to what it was
      element.style.clear = originalClearStyle
    }

    return aboveFold
  }
  return Array.from(document.getElementsByTagName('*'))
    .filter(isElementAboveFold)
    .map(window.getComputedStyle)
    .map(style => style.fontFamily)
}
