const fs = require('fs');
const path = require('path');

const srcDatabase = path.join(__dirname, 'database');
const destMigrations = path.join(__dirname, 'supabase', 'migrations');
const srcStores = path.join(__dirname, 'src', 'stores');

// Create migrations dir if not exists
if (!fs.existsSync(destMigrations)) {
    fs.mkdirSync(destMigrations, { recursive: true });
}

// Move files from database to supabase/migrations
if (fs.existsSync(srcDatabase)) {
    const files = fs.readdirSync(srcDatabase);
    for (const file of files) {
        const srcPath = path.join(srcDatabase, file);
        const destPath = path.join(destMigrations, file);
        if (fs.statSync(srcPath).isFile()) {
            fs.renameSync(srcPath, destPath);
        } else if (fs.statSync(srcPath).isDirectory()) {
            // move contents of subdirectory
            const subFiles = fs.readdirSync(srcPath);
            for (const subFile of subFiles) {
                const subSrc = path.join(srcPath, subFile);
                const subDest = path.join(destMigrations, subFile);
                fs.renameSync(subSrc, subDest);
            }
            fs.rmSync(srcPath, { recursive: true, force: true });
        }
    }
    fs.rmSync(srcDatabase, { recursive: true, force: true });
    console.log("Moved database to supabase/migrations and deleted database folder.");
}

// Delete src/stores
if (fs.existsSync(srcStores)) {
    fs.rmSync(srcStores, { recursive: true, force: true });
    console.log("Deleted src/stores folder.");
}
