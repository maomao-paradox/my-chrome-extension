import path from 'path'
import fs from 'fs'

function generateFileMap() {
    const outDir = path.resolve(__dirname, '..', 'dist');
    const fileMap: Record<string, string> = {};

    try {
        const manifestPath = path.join(outDir, '.vite', 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            for (const [originalPath, entry] of Object.entries(manifest)) {
                const entryData = entry as any;
                if (originalPath.includes("/manifest") || originalPath.startsWith("_")) {
                    continue;
                }

                if (originalPath.includes('runtime/')) {
                    const originalFilePath = `js/${entryData.name}`;
                    fileMap[originalFilePath] = entryData.file;
                }

                else if (originalPath.includes('apps/') || originalPath.includes('content/')) {
                    const originalFilePath = `js/${entryData.name}`;
                    fileMap[originalFilePath] = entryData.file;

                    if (entryData.css && Array.isArray(entryData.css)) {
                        const parts = entryData.name.split('/');
                        const fileName = parts[parts.length - 1];
                        entryData.css.forEach((cssFile: string) => {
                            const originalCssPath = `css/${fileName}`;
                            if (!fileMap[originalCssPath]) {
                                fileMap[originalCssPath] = cssFile;
                            }
                        });
                    }
                }

                else if (entryData.css && Array.isArray(entryData.css)) {
                    entryData.css.forEach((cssFile: string) => {
                        let originalFileName = path.basename(cssFile);
                        let originalFilePath = `css/${originalFileName}`;

                        if (originalPath.includes('apps/')) {
                            const parts = originalPath.split('/');
                            const appName = parts[parts.length - 2];
                            originalFileName = `${appName}`;
                            originalFilePath = `css/${originalFileName}`;
                        } else if (entryData.name) {
                            let appName = entryData.name;
                            if (appName.includes('/')) {
                                const nameParts = appName.split('/');
                                appName = nameParts[nameParts.length - 1];
                            }
                            originalFileName = `${appName}`;
                            originalFilePath = `css/${originalFileName}`;
                        } else if (originalPath.includes('/')) {
                            const parts = originalPath.split('/');
                            const dirName = parts[parts.length - 2];
                            originalFileName = `${dirName}`;
                            originalFilePath = `css/${originalFileName}`;
                        }

                        if (!fileMap[originalFilePath]) {
                            fileMap[originalFilePath] = cssFile;
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error reading manifest file:', error);
    }

    const mapPath = path.join(outDir, 'file-map.json');
    fs.writeFileSync(mapPath, JSON.stringify(fileMap, null, 2));
    console.log('✅ file-map.json saved');
}


function generateFileMapPlugin() {
    return {
        name: 'generate-file-map',

        apply: 'build',

        async closeBundle() {
            generateFileMap()
        }
    };
}


export default generateFileMapPlugin