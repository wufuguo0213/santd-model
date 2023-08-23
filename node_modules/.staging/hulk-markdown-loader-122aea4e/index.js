/**
 * @file markdown loader
 * @author wangyongqing <wangyongqing01@baidu.com>
 */
const path = require('path');
const fs = require('fs');

const sanLoader = require('hulk-san-loader').loader;

const compiler = require('./utils/compiler');
const defaultTemplate = path.join(__dirname, './template.san');
const loaderUtils = require('loader-utils');
const genTemplate = require('./utils/genTemplate');
const getText = require('./utils/getText').getText;

const EXPORT_TYPES = ['app', 'html', 'component', 'object', 'md', 'markdown'];

function getMarkdownDefaultSanCode(content, cls = ['markdown']) {
    if (!Array.isArray(cls)) {
        cls = cls.split(/\s+/);
    }

    if (!~cls.indexOf('markdown')) {
        cls.push('markdown');
    }

    return `
    <template><section class="${cls.join(' ')}">${content}</section></template>
    <script>export default{}</script>
`;
}
// eslint-disable-next-line
module.exports = function(content) {
    this.cacheable && this.cacheable();

    const {resourcePath, resourceQuery} = this;
    const params = resourceQuery !== '' ? loaderUtils.parseQuery(resourceQuery) : {};
    // eslint-disable-next-line
    let {
        ignore,
        template,
        context = process.cwd(),
        textTag = 'text',
        i18n = 'cn',
        exportType = EXPORT_TYPES.includes(params.exportType) ? params.exportType : 'app'
    } = loaderUtils.getOptions(this) || {};

    if (params.template) {
        // url 中自定义 template
        context = path.basename(resourcePath);
        template = params.template;
    }

    if (Object.prototype.toString.call(ignore).slice(8, -1) === 'RegExp') {
        // 配置忽略
        if (ignore.test(resourcePath)) {
            return content;
        }
    }

    const m = content.match(/```html\s+(.+?)\s+```/s);
    let code;
    if (m && m[1]) {
        // 一个 md 只能有一个 html
        code = m[1];
    }

    const text = getText(content, textTag, i18n);

    const contentObj = {
        code,
        text,
        content
    };
    // 获取 template 内容
    let templateContent = '';
    if (template && path.join(context, template)) {
        templateContent = fs.readFileSync(path.join(context, template), 'utf8');
    } else {
        templateContent = fs.readFileSync(defaultTemplate, 'utf8');
    }
    // console.log('\n', resourcePath, exportType);
    switch (exportType) {
        case 'html':
            const html = JSON.stringify(compiler(content))
                .replace(/\u2028/g, '\\u2028')
                .replace(/\u2029/g, '\\u2029');
            return `export default ${html}`;
        case 'markdown':
        case 'md':
            const json = JSON.stringify(content)
                .replace(/\u2028/g, '\\u2028')
                .replace(/\u2029/g, '\\u2029');
            return `export default ${json}`;
        case 'component':
            // 将 code 转成独立 san component 返回
            const getSingleComponent = genSingleComponent.bind(this);
            return getSingleComponent(templateContent, contentObj);
        case 'object':
            // 将md 拆分成对象返回
            const genObjectCode = genObject.bind(this);
            return genObjectCode(templateContent, contentObj);
        default:
            // 默认是 app
            const callback = this.async();
            // 按照 template，返回app整体的 san component
            const genComponentCode = genAppComponent.bind(this);
            const tCode = genComponentCode(templateContent, contentObj);
            let {rootContext = process.cwd(), resourcePath, resourceQuery, query} = this;
            sanLoader(
                tCode,
                {
                    sourceMap: false,
                    hotReload: true,
                    minimize: false,
                    query,
                    resourcePath,
                    resourceQuery,
                    rootContext
                },
                callback
            );
    }
};

function genSingleComponent(template, data) {
    const {resourcePath} = this;
    const requirePath = getComponentImportFromCode(resourcePath, data.content);
    return `
    import sanComponent from '${requirePath}';
    export default sanComponent;
    `;
}

function genObject(template, data) {
    const {resourcePath} = this;
    if (data.code) {
        const requirePath = getComponentImportFromCode(resourcePath, data.content);
        data.sanComponent = 'sanComponent';
        data.hasCode = true;
        return `
import sanComponent from '${requirePath}';
export default ${JSON.stringify(data).replace(/(['"])sanComponent\1/g, 'sanComponent')};
`;
    } else {
        data.hasCode = false;
        return `export default ${JSON.stringify(data)}`;
    }
}

function genAppComponent(template, {text, code, content}) {
    const {resourcePath} = this;
    // getsource
    if (!code) {
        // 说明是纯 markdown
        return getMarkdownDefaultSanCode(compiler(content));
    }
    const textHtml = text ? compiler(text) : text;

    // 这里判断下是否是严格意义上的 san 组件
    // 1. 存在 template tag，并且肯定不是一上来就闭合吧
    if (!~code.indexOf('</template>')) {
        return getMarkdownDefaultSanCode(textHtml);
    }

    // 解决文档中的语法被解析的问题
    let codeHtml = `<pre><code class="language-html">${code
        .replace(/</g, '&lt;')
        .replace(/`/g, '&#96;')
        .replace(/\${/g, '&#36;&#123;')}</code></pre>`;
    // let codeHtml = compiler('```html\n' + code + '\n```').replace(/`/g, '\\`');

    const requirePath = getComponentImportFromCode(resourcePath, content);

    let id = 'components-demo-' + Date.now();
    const sanComponent = genTemplate(template, {
        id,
        text: textHtml,
        code: codeHtml,
        dyImport: `import codePreview from '${requirePath}'`
    });
    return sanComponent;
}

function getComponentImportFromCode(resourcePath, content) {
    const requireReg = /<![-]{2,}require\((['"])(.+?)\1\)[-]{2,}>/;
    const requirejs = content.match(requireReg);
    let dyImport;
    if (requirejs && requirejs[2]) {
        // 说明使用了`<!--require()-->`语法引入
        const importFilePath = path.resolve(resourcePath, requirejs[2]);
        dyImport = importFilePath;
    } else {
        const pickLoader = require.resolve('./utils/pickFence.js');
        const fakemd = `${require.resolve('./utils/_fakemd')}?mdurl=${resourcePath}&_t=${Date.now()}`;

        dyImport = `${require.resolve('hulk-san-loader')}!${pickLoader}?url=${resourcePath}!${fakemd}`;
    }
    return dyImport;
}
