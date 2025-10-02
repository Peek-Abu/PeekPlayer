import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate embed HTML for server integration
 * @param {Object} options - Configuration options
 * @param {string} options.cssPath - Path to CSS file (e.g., '/peekplayer/style.css')
 * @param {string} options.jsPath - Path to JS bundle (e.g., '/peekplayer/peekplayer-embed.js')
 * @param {string} options.templatePath - Optional custom template path
 * @returns {string} Generated HTML string
 */
export function generateEmbedHTML(options = {}) {
    const {
        cssPath = '/peekplayer/style.css',
        jsPath = '/peekplayer/peekplayer-embed.js',
        templatePath = null
    } = options;

    // Use custom template or default
    const templateFile = templatePath || path.join(__dirname, '../../templates/embed.html');
    
    if (!fs.existsSync(templateFile)) {
        throw new Error(`Template file not found: ${templateFile}`);
    }

    let html = fs.readFileSync(templateFile, 'utf8');
    
    // Replace placeholders
    html = html.replace('{{CSS_PATH}}', cssPath);
    html = html.replace('{{JS_PATH}}', jsPath);
    
    return html;
}

/**
 * Express.js middleware factory for serving PeekPlayer embed
 * @param {Object} options - Configuration options
 * @param {string} options.staticPath - Base path for static files (e.g., '/peekplayer')
 * @param {string} options.packagePath - Path to PeekPlayer package (e.g., './node_modules/@brukabu/peekplayer')
 * @returns {Function} Express middleware function
 */
export function createEmbedMiddleware(options = {}) {
    const {
        staticPath = '/peekplayer',
        packagePath = './node_modules/@brukabu/peekplayer'
    } = options;

    return (req, res) => {
        try {
            res.setHeader('X-Frame-Options', 'ALLOWALL');
            res.setHeader('Content-Type', 'text/html');
            
            const html = generateEmbedHTML({
                cssPath: `${staticPath}/style.css`,
                jsPath: `${staticPath}/peekplayer-embed.js`
            });
            
            res.send(html);
        } catch (error) {
            console.error('Error generating embed HTML:', error);
            res.status(500).json({
                error: 'Failed to generate embed HTML',
                message: error.message
            });
        }
    };
}

/**
 * Express.js static file setup helper
 * @param {Object} app - Express app instance
 * @param {Object} options - Configuration options
 * @param {string} options.staticPath - URL path for static files (e.g., '/peekplayer')
 * @param {string} options.packagePath - File system path to PeekPlayer package
 */
export function setupPeekPlayerStatic(app, options = {}) {
    const {
        staticPath = '/peekplayer',
        packagePath = './node_modules/@brukabu/peekplayer'
    } = options;

    // Serve PeekPlayer static files
    app.use(staticPath, express.static(path.join(process.cwd(), packagePath, 'dist')));
    app.use(`${staticPath}/style.css`, express.static(path.join(process.cwd(), packagePath, 'style.css')));
}

// Default export for CommonJS compatibility
export default {
    generateEmbedHTML,
    createEmbedMiddleware,
    setupPeekPlayerStatic
};
