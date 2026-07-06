import path from 'path'
import fs from 'fs'

interface ScanFilesOptions {
    dirPath: string
    prefix: string
    extFilter?: string | string[]
    exclude?: string[]
    useIndexFile?: boolean
    recursive?: boolean
}

function scanFiles(options: ScanFilesOptions): Record<string, string> {
  const { 
    dirPath, 
    prefix, 
    extFilter = ['.js', '.ts'], 
    exclude = [],
    useIndexFile = false,
    recursive = false 
  } = options

  const resolvedPath = path.resolve(__dirname, '..', dirPath)
  const inputConfig: Record<string, string> = {}

  try {
    const items = fs.readdirSync(resolvedPath, { withFileTypes: true })

    items.forEach(item => {
      const fullPath = path.resolve(resolvedPath, item.name)

      if (item.isFile()) {
        const ext = path.extname(item.name)
        const isValidExt = Array.isArray(extFilter) 
          ? extFilter.includes(ext) 
          : ext === extFilter
        
        if (isValidExt && !exclude.includes(item.name)) {
          const fileName = item.name.replace(new RegExp(`${ext}$`), '')
          inputConfig[`${prefix}/${fileName}`] = fullPath
        }
      } else if (item.isDirectory() && (useIndexFile || recursive)) {
        const indexFilePath = path.resolve(fullPath, 'index.ts')
        if (useIndexFile && fs.existsSync(indexFilePath)) {
          inputConfig[`${prefix}/${item.name}`] = indexFilePath
        } else if (recursive) {
          const nestedItems = fs.readdirSync(fullPath)
          nestedItems.forEach(nestedItem => {
            const ext = path.extname(nestedItem)
            const isValidExt = Array.isArray(extFilter) 
              ? extFilter.includes(ext) 
              : ext === extFilter
            
            if (isValidExt && !exclude.includes(nestedItem)) {
              const fileName = nestedItem.replace(new RegExp(`${ext}$`), '')
              inputConfig[`${prefix}/${fileName}`] = path.resolve(fullPath, nestedItem)
            }
          })
        }
      }
    })
  } catch (error) {
    console.error(`扫描${dirPath}目录文件失败:`, error)
  }

  return inputConfig
}


export default scanFiles
