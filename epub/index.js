import fs from 'node:fs/promises'
import {fromMarkdown} from 'mdast-util-from-markdown'
import {toMarkdown} from 'mdast-util-to-markdown'
import {mdxjs} from 'micromark-extension-mdxjs'
import {mdxFromMarkdown, mdxToMarkdown} from 'mdast-util-mdx'
import {visit} from 'unist-util-visit'
import {remove} from 'unist-util-remove'

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

  const out = toMarkdown(tree, {extensions: [mdxJsxToMarkdown()]})

  //console.log(out)
}

for (const mdxPath of frontAndBodyMatter) {
  console.log(mdxPath)
  await convert(mdxPath)
}
