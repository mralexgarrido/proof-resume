/* Local resume exports. Original MIT-licensed code; no runtime dependencies. */
const ProofExport = (() => {
  'use strict';
  const encoder = new TextEncoder();
  const str = value => String(value ?? '');
  // XML 1.0 excludes controls, lone surrogates, and U+FFFE/U+FFFF.
  function clean(value) {
    return Array.from(str(value)).filter(character => {
      const code = character.codePointAt(0);
      return code === 9 || code === 10 || code === 13 ||
        (code >= 32 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff);
    }).join('');
  }
  const xml = value => clean(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[character]));

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // STORE mode creates a standards-based ZIP entirely in the browser.
  function zip(files) {
    if (!Array.isArray(files) || files.length > 65535) throw new Error('Too many export files.');
    const chunks = [], directory = [], names = new Set();
    let offset = 0;
    for (const [name, value] of files) {
      if (typeof name !== 'string' || !name || names.has(name)) throw new Error('Invalid export file name.');
      names.add(name);
      const filename = encoder.encode(name), data = value instanceof Uint8Array ? value : encoder.encode(str(value));
      if (filename.length > 65535 || data.length > 0xffffffff || offset > 0xffffffff) throw new Error('Export is too large.');
      const checksum = crc32(data);
      const header = new Uint8Array(30 + filename.length), view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x800, true); // UTF-8 names.
      view.setUint16(12, 33, true); // 1980-01-01.
      view.setUint32(14, checksum, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, filename.length, true);
      header.set(filename, 30);
      chunks.push(header, data);
      const record = new Uint8Array(46 + filename.length), central = new DataView(record.buffer);
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);
      central.setUint16(6, 20, true);
      central.setUint16(8, 0x800, true);
      central.setUint16(14, 33, true);
      central.setUint32(16, checksum, true);
      central.setUint32(20, data.length, true);
      central.setUint32(24, data.length, true);
      central.setUint16(28, filename.length, true);
      central.setUint32(42, offset, true);
      record.set(filename, 46);
      directory.push(record);
      offset += header.length + data.length;
    }
    const directorySize = directory.reduce((total, record) => total + record.length, 0);
    if (offset + directorySize > 0xffffffff) throw new Error('Export is too large.');
    const end = new Uint8Array(22), endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, directorySize, true);
    endView.setUint32(16, offset, true);
    const output = new Uint8Array(offset + directorySize + end.length);
    let position = 0;
    for (const chunk of [...chunks, ...directory, end]) { output.set(chunk, position); position += chunk.length; }
    return output;
  }

  function safeURL(value) {
    const input = str(value).trim();
    if (!input || /[\s\u0000-\u001f\u007f]/u.test(input) || input.startsWith('//')) return '';
    if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) return '';
    const candidate = /^https?:\/\//i.test(input) ? input : 'https://' + input;
    try {
      const url = new URL(candidate);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) return '';
      return url.href;
    } catch { return ''; }
  }

  function contactTarget(state, displayed) {
    const contact = state.contact || {}, value = str(displayed).trim();
    if (value === str(contact.email).trim() && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(value)) {
      return 'mailto:' + encodeURIComponent(value).replace(/%40/g, '@');
    }
    if (value === str(contact.linkedin).trim() || value === str(contact.portfolio).trim()) return safeURL(value);
    return '';
  }

  function docx(state, variantId) {
    const content = ProofCore.content(state, variantId), variant = ProofCore.variant(state, variantId);
    const font = variant.style === 'classic' ? 'Georgia' : 'Arial';
    const size = variant.density === 'compact' ? 21 : 22;
    const spacing = variant.density === 'compact' ? 50 : 75;
    const page = variant.paperSize === 'a4' ? { width: 11906, height: 16838 } : { width: 12240, height: 15840 };
    const links = [];
    const run = value => '<w:r>' + clean(value).split(/(\r\n|\r|\n|\t)/).map(part =>
      part === '\t' ? '<w:tab/>' : /^(\r\n|\r|\n)$/.test(part) ? '<w:br/>' : `<w:t xml:space="preserve">${xml(part)}</w:t>`
    ).join('') + '</w:r>';
    const paragraph = (value, style = 'Normal', options = {}) => {
      const keep = Object.hasOwn(options, 'keepNext') ? `<w:keepNext w:val="${options.keepNext ? 1 : 0}"/>` : '';
      const bullet = style === 'ListBullet' ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : '';
      return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${keep}${bullet}</w:pPr>${options.runs ?? run(value)}</w:p>`;
    };
    const contactRuns = content.contact.map((value, index) => {
      const target = contactTarget(state, value);
      let item = run(value);
      if (target) {
        const id = 'contact' + (links.length + 1);
        links.push({ id, target });
        item = `<w:hyperlink r:id="${id}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:hyperlink>`;
      }
      return (index ? run(' | ') : '') + item;
    }).join('');
    let body = paragraph(content.name || 'Your name', 'Title');
    if (content.contact.length) body += paragraph('', 'Contact', { runs: contactRuns });
    if (content.headline) body += paragraph(content.headline, 'Focus', { keepNext: false });
    if (content.summary) body += paragraph(content.summary);
    for (const section of content.sections) {
      body += paragraph(section.title, 'Heading1');
      for (const entry of section.entries) {
        const hasBullets = entry.bullets.length > 0;
        if (entry.title) body += paragraph(entry.title, 'EntryTitle', { keepNext: !!entry.sub || hasBullets });
        if (entry.sub) body += paragraph(entry.sub, 'Subtitle', { keepNext: hasBullets });
        for (const bullet of entry.bullets) body += paragraph(bullet, 'ListBullet');
      }
    }
    const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    return zip([
      ['[Content_Types].xml', header + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
      ['_rels/.rels', header + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + rel + '/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
      ['word/document.xml', header + `<w:document xmlns:w="${w}" xmlns:r="${rel}"><w:body>${body}<w:sectPr><w:pgSz w:w="${page.width}" w:h="${page.height}"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`],
      ['word/styles.xml', header + `<w:styles xmlns:w="${w}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:color w:val="000000"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="${spacing}" w:line="250" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="50"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Contact"><w:name w:val="Contact details"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="120"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Focus"><w:name w:val="Professional focus"/><w:basedOn w:val="Normal"/><w:rPr><w:b/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="210" w:after="90"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="EntryTitle"><w:name w:val="Entry title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepLines/><w:spacing w:before="85" w:after="45"/></w:pPr><w:rPr><w:b/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Entry context"/><w:basedOn w:val="Normal"/><w:pPr><w:keepLines/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="${spacing}"/><w:keepLines/></w:pPr></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="000000"/><w:u w:val="single"/></w:rPr></w:style></w:styles>`],
      ['word/numbering.xml', header + `<w:numbering xmlns:w="${w}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="260"/></w:tabs><w:ind w:left="260" w:hanging="200"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`],
      ['word/_rels/document.xml.rels', header + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="' + rel + '/styles" Target="styles.xml"/><Relationship Id="numbering" Type="' + rel + '/numbering" Target="numbering.xml"/>' + links.map(link => `<Relationship Id="${link.id}" Type="${rel}/hyperlink" Target="${xml(link.target)}" TargetMode="External"/>`).join('') + '</Relationships>'],
      ['docProps/core.xml', header + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' + xml((content.name || 'Student') + ' Resume') + '</dc:title><dc:creator>' + xml(content.name) + '</dc:creator></cp:coreProperties>']
    ]);
  }

  function text(state, variantId) {
    const content = ProofCore.content(state, variantId), blocks = [];
    const introduction = [content.name, content.contact.join(' | '), content.headline, content.summary].filter(Boolean);
    if (introduction.length) blocks.push(introduction.join('\n'));
    for (const section of content.sections) {
      const entries = section.entries.map(entry => [entry.title, entry.sub, ...entry.bullets.map(bullet => '- ' + bullet)].filter(Boolean).join('\n'));
      blocks.push(section.title + '\n' + entries.join('\n\n'));
    }
    return clean(blocks.join('\n\n')) + '\n';
  }

  function interviewText(state, includePrivate = false) {
    const content = ProofCore.content(state), variant = ProofCore.variant(state);
    const cards = new Map(ProofCore.cards(state).map(card => [card.contribution.id, card]));
    const blocks = ['Interview practice\n' + [content.name, variant.name].filter(Boolean).join('\n')];
    blocks.push(includePrivate === true ? 'Includes your private evidence and rehearsal notes.' : 'Practice questions for the contributions in this resume. Private notes are excluded.');
    for (const section of content.sections) for (const entry of section.entries) {
      entry.bulletIds.forEach((id, index) => {
        const card = cards.get(id);
        if (!card) return;
        const bullet = entry.bullets[index];
        // Questions may use the public variant wording, but never private fields.
        const publicCard = { id, text: bullet, action: '', method: '', result: '', evidence: '', reflection: '', attribution: card.contribution.attribution, reviewed: false, tags: [], interview: {} };
        const questions = ProofCore.rehearsal(publicCard, bullet);
        const lines = [entry.title, bullet, '', ...questions.map((question, number) => `${number + 1}. ${question}`)];
        if (includePrivate === true) {
          const contribution = card.contribution;
          if (contribution.evidence) lines.push('', 'Evidence: ' + contribution.evidence);
          if (contribution.reflection) lines.push('Reflection: ' + contribution.reflection);
          for (const [key, label] of [['situation', 'Situation'], ['task', 'Task'], ['action', 'Action'], ['result', 'Result'], ['lesson', 'Lesson']]) {
            if (contribution.interview?.[key]) lines.push(label + ': ' + contribution.interview[key]);
          }
        }
        blocks.push(lines.filter(value => value !== undefined).join('\n'));
      });
    }
    return clean(blocks.join('\n\n')) + '\n';
  }

  return { docx, text, interviewText, zip, crc32 };
})();
