const archiver = require('archiver');
const fs = require('fs');
const util = require('util');
const glob = util.promisify(require('glob'));
const download = require('download');
const readFile = util.promisify(fs.readFile);

const {
    urlrewriteXmlContent,
    webXmlContent,
} = require('./templates');

const zipOptions = {
    store: true,
    zlib: {level: 0}
};


function webXml(archive, displayName, description) {
    return Promise.resolve()
        .then(() => archive.append(webXmlContent(displayName, description), {name: 'WEB-INF/web.xml'}));
}

function urlrewriteXml(archive, srcDir, passThrough) {
    return glob(`${srcDir}/**`, {
        nosort: true,
        nodir: true,
        ignore: `${srcDir}/index.html`
    })
        .then(files => files
            .map(file => file.replace(`${srcDir}/`, ''))
            .join('|'))
        .then(directFilesRegex => archive.append(urlrewriteXmlContent(directFilesRegex, passThrough), {name: 'WEB-INF/urlrewrite.xml'}));
}

function urlrewritefilterJar(archive, urlrewritefilterJarUrl) {
    return download(urlrewritefilterJarUrl)
        .then(buffer => archive.append(buffer, {name: 'WEB-INF/lib/urlrewritefilter.jar'}));
}

function source(archive, srcDir) {
    return glob(`${srcDir}/**`, {nosort: true, nodir: true})
        .then(files => Promise.all(files
            .map(file => readFile(file)
                .then(buffer => {
                    const name = file.replace(`${srcDir}/`, '');
                    archive.append(buffer, {name})
                }))));
}

function newWar(outputFile) {
    const archive = archiver('zip', zipOptions);
    const output = fs.createWriteStream(outputFile);

    archive.on('error', err => {
        throw err
    });
    archive.pipe(output);
    return archive;
}

function makeWar(opts = {}) {
    const outputFile = opts['output'];
    const srcDir = opts['input-dir'];
    const description = opts['description'];
    const displayName = opts['name'];
    const passThrough = opts['pass-through'];
    const urlrewritefilterJarUrl = opts['urlrewritefilter-jar-url'];

    const archive = newWar(outputFile);

    return Promise.all([
        source(archive, srcDir),
        urlrewritefilterJar(archive, urlrewritefilterJarUrl),
        urlrewriteXml(archive, srcDir, passThrough),
        webXml(archive, displayName, description)
    ])
        .then(() => archive.finalize())

}

module.exports = makeWar;
