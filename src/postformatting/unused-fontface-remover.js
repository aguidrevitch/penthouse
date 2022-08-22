import csstree from 'css-tree'
import debug from 'debug'

const debuglog = debug('penthouse:css-cleanup:unused-font-face-remover')

function decodeFontName (node) {
  let name = csstree.generate(node)
  // TODO: use string decode
  if (name[0] === '"' || name[0] === "'") {
    name = name.substr(1, name.length - 2)
  }
  return name
}

const variables = {}

function recurse (node) {
  const result = []
  if (node.type === 'String') {
    result.push(node.value)
  } else if (node.type === 'Identifier') {
    let matches
    if ((matches = node.name.match(/^(--.*)/)) && variables[matches[0]]) {
      ;[...variables[matches[0]]].forEach(value => result.push(value))
    } else {
      result.push(node.name)
    }
  } else if (node.children) {
    node.children.forEach(node => {
      result.push(...recurse(node))
    })
  } else {
    // debuglog('warn 2', csstree.walk.generate(node), node)
  }
  return result
}

function getAllFontNameValues (ast) {
  const fontNameValues = new Set()

  debuglog('getAllFontNameValues')
  csstree.walk(ast, {
    visit: 'Declaration',
    enter: function (node) {
      // walker pass through `font-family` declarations inside @font-face too
      // this condition filters them, to walk through declarations inside a rules only
      if (node.property.match(/^--/)) {
        variables[node.property] = variables[node.property] || new Set()
        if (node.value.children) {
          node.value.children
            .filter(value => value.type !== 'Operator')
            .forEach(value => {
              // probably not exactly right because quotes are stripped in decodeFontName
              // for values different than font family but it is fine, we only need font-family
              variables[node.property].add(decodeFontName(value))
            })
        } else {
          // probably not exactly right because quotes are stripped in decodeFontName
          // for values different than font family but it is fine, we only need font-family
          variables[node.property].add(decodeFontName(node.value))
        }
        return
      }

      if (this.rule) {
        if (node.property === 'font-family') {
          recurse(node.value).forEach(value =>
            fontNameValues.add(value.toLowerCase())
          )
        } else if (node.property === 'font') {
          recurse(node.value.children.last).forEach(value =>
            fontNameValues.add(value.toLowerCase())
          )
        }
      }
    }
  })
  debuglog('getAllFontNameValues AFTER')
  return fontNameValues
}

export default function unusedFontfaceRemover (ast) {
  const fontNameValues = getAllFontNameValues(ast)

  // remove @font-face at-rule when:
  // - it's never unused
  // - has no a `src` descriptor
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, atruleItem, atruleList) => {
      if (csstree.keyword(atrule.name).basename !== 'font-face') {
        return
      }

      let hasSrc = false
      let used = true

      csstree.walk(atrule, {
        visit: 'Declaration',
        enter: declaration => {
          const name = csstree.property(declaration.property).name

          if (name === 'font-family') {
            const familyName = decodeFontName(declaration.value).toLowerCase()

            // was this @font-face used?
            if (!fontNameValues.has(familyName)) {
              debuglog('drop unused @font-face: ' + familyName)
              used = false
            }
          } else if (name === 'src') {
            hasSrc = true
          }
        }
      })

      if (!used || !hasSrc) {
        if (used && !hasSrc) {
          debuglog('drop @font-face with no src descriptor')
        }
        atruleList.remove(atruleItem)
      }
    }
  })
}
