import fs from 'node:fs/promises'
import {fromMarkdown} from 'mdast-util-from-markdown'
import {toMarkdown} from 'mdast-util-to-markdown'
import {mdxjs} from 'micromark-extension-mdxjs'
import {mdxFromMarkdown, mdxToMarkdown} from 'mdast-util-mdx'
import {visit} from 'unist-util-visit'
import {remove} from 'unist-util-remove'
import * as path from 'path'

import {SKIP} from 'unist-util-visit'
import {mdxJsxFromMarkdown, mdxJsxToMarkdown} from 'mdast-util-mdx-jsx'

//import {preface} from '../pages/preface.mdx'

const frontMatterDirectory = "../pages"
const frontMatter = [
  "toc.mdx",
  "foreword.mdx",
  "preface.mdx",
  "please-donate.mdx",
  "about.mdx"
].map(doc => frontMatterDirectory + "/" + doc);

import chaptersMetaJSON from "../pages/chapters/meta.json" assert { type: "json" };

const bodyMatterDirectory = "../pages/chapters"
const chapters = Object.keys(chaptersMetaJSON).map(chapter => bodyMatterDirectory + "/" + chapter + ".mdx")

const frontAndBodyMatter = frontMatter.concat(chapters);

const buildDirectory = './build';

// Remove & Recreate build directory
try {
  await fs.rmdir(buildDirectory, { recursive: true, force: true })
} catch (error) {
  console.error(error);
}
await fs.mkdir(buildDirectory)

var markdownFiles = [];
async function convert(mdxPath) {
  var doc;
  try {
    doc = await fs.readFile(mdxPath)
  } catch (error) {
    console.error(error);
    return
  }

  const tree = fromMarkdown(doc, {
    extensions: [mdxjs()],
    mdastExtensions: [mdxFromMarkdown()]
  })

  remove(tree, 'mdxjsEsm')
  remove(tree, 'mdxJsxFlowElement')
  remove(tree, 'mdxFlowElement')
  remove(tree, 'mdxFlowExpression')

  visit(tree, (node) => {
    if (node.type.includes("mdx")) {
      console.log(node)
    }
  })

  visit(tree, 'mdxFlowExpression', (node) => {
    console.log(node)
    node.value = "{ " + node.value + " }"
    node.type = "text" 
  })

  visit(tree, 'mdxTextExpression', (node) => {
    console.log(node)
    node.type = "text" 
  })

  visit(tree, 'mdxJsxTextElement', (node, index, parent) => {
    if (node.children[0] && node.children[0].type == "text") {
      node.type = "text"
      node.value = node.children[0].text
    } else {
      // Remove elements without children
      parent.children.splice(index, 1)
      return [SKIP, index]
    }
  })

  const out = toMarkdown(tree)

  try {
    const filename = path.basename(mdxPath)
    const name = path.parse(filename).name
    const outputMarkdown = buildDirectory + "/" + name + ".md"
    doc = await fs.writeFile(outputMarkdown, out)
    markdownFiles.push(outputMarkdown)
  } catch (error) {
    console.error(error);
    return
  }
}

for (const mdxPath of frontAndBodyMatter) {
  console.log(mdxPath)
  await convert(mdxPath)
}
