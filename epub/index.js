import fs from 'node:fs/promises'
import {fromMarkdown} from 'mdast-util-from-markdown'
import {toMarkdown} from 'mdast-util-to-markdown'
import {mdxjs} from 'micromark-extension-mdxjs'
import {mdxFromMarkdown, mdxToMarkdown} from 'mdast-util-mdx'
import {visit} from 'unist-util-visit'
import {remove} from 'unist-util-remove'
import * as path from 'path'
import * as util from 'util'
import {exec} from 'child_process'
import fsExists from 'fs.promises.exists'

import {SKIP} from 'unist-util-visit'
import {mdxJsxFromMarkdown, mdxJsxToMarkdown} from 'mdast-util-mdx-jsx'

import * as download from 'image-downloader'
import { fileURLToPath } from "node:url";

// Helper functions
//

function downloadImage(url, filepath) {
    return download.image({
       url,
       dest: filepath 
    });
}

const getBasenameFromUrl = (urlStr) => {
    const url = new URL(urlStr)
    return path.basename(url.pathname)
}

// Path & File Constants
//
const scriptDir = path.dirname(fileURLToPath(import.meta.url))

const pagesDirectory = path.join("..", "pages")
const chaptersPath = path.join(pagesDirectory, "chapters")

const buildDirectory = path.join(scriptDir, 'build');
const imagesDirectory = path.join(buildDirectory, "images");

const imageNotFoundFilename = "image_not_found.png"
const imageNotFoundPath = path.join(scriptDir, imageNotFoundFilename)

const coverImageFilename = "cover-image.jpg"
const coverImagePath = path.join(scriptDir, coverImageFilename)

const metadataPath = path.join(scriptDir, "metadata.yml")

const frontMatter = [
  "toc.mdx",
  "foreword.mdx",
  "preface.mdx",
  "please-donate.mdx",
  "about.mdx"
].map(doc => path.join(pagesDirectory, doc));

import chaptersMetaJSON from "../pages/chapters/meta.json" assert { type: "json" };
const chapters = Object.keys(chaptersMetaJSON).map(chapter => path.join(chaptersPath, chapter + ".mdx"))

const frontAndBodyMatter = frontMatter.concat(chapters);

// Remove build directory
//
//try {
  //await fs.rmdir(buildDirectory, { recursive: true, force: true })
//} catch (error) {
  //console.error(error);
//}

// Recreate Build Directory
//
//await fs.mkdir(buildDirectory)
//await fs.mkdir(imagesDirectory)

// Copy standard images to build folder
//
//await fs.copyFile(imageNotFoundPath, path.join(imagesDirectory, imageNotFoundFilename))
//await fs.copyFile(coverImagePath, path.join(imagesDirectory, coverImageFilename))

async function epubGenerate(input) {
  const command = 'pandoc -o TYCHOS.epub "' + metadataPath + '" -f gfm -t epub ' + input
  console.log(command)
  const { stdout, stderr } = await exec(command);
  //console.log('stdout:', stdout);
  //console.log('stderr:', stderr);
}

var markdownFiles = [];
var markdown = [];
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
      //console.log(node)
    }
  })

  var imageURLs = [];
  visit(tree, 'image', (node, index, parent) => {
    imageURLs.push(node.url)
    console.log(node.url)
  })

  var imageURLtoFile = {};
  for (const url of imageURLs) {
    console.log(url)
    let filename = path.basename(url);
    
    // URI encoded things cause problems, needs to be decoded
    filename = decodeURI(filename)

    const imagePath = process.cwd() + "/build" + '/' + "images"+ '/' + filename;

    console.log(url)
    try {
      if (await fsExists(imagePath) == false) {
        //await downloadImage(url, imagePath)
        imageURLtoFile[url] = imagePath
      }
    } catch (error) {
      console.error(error);
      imageURLtoFile[url] = imageNotFoundPath
      return
    }
  }

  visit(tree, 'image', (node, index, parent) => {
    const localImagePath = imageURLtoFile[node.url]
    if (localImagePath) {
      node.url = localImagePath
    } else {
      console.error("Image not found even after initial parsing")
      node.url = imageNotFoundPath
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
    markdown.push(out)
    //await epubGenerate(outputMarkdown)
  } catch (error) {
    console.error(error);
    return
  }
}

// Convert all book components to regular markdown
for (const mdxPath of frontAndBodyMatter) {
  console.log(mdxPath)
  await convert(mdxPath)
}

//try {
  //const combinedMarkdown = buildDirectory + "/tychos_combined.md"
  //await fs.writeFile(combinedMarkdown, markdown.join(' '))
  //await epubGenerateSingle(combinedMarkdown, "combined")
//} catch (error) {
  //console.error(error);
//}

// Compile markdown to epub with pandoc
const allMarkdownFiles = markdownFiles.map(doc => '"'+doc+'"').join(' ')

console.log(allMarkdownFiles)

//async function epubGenerate() {
  //const command = 'pandoc -o TYCHOS.epub --metadata title="'+title+'" -f gfm -t epub ' + allMarkdownFiles
  //console.log(command)
  //const { stdout, stderr } = await exec(command);
  ////console.log('stdout:', stdout);
  ////console.log('stderr:', stderr);
//}

await epubGenerate(allMarkdownFiles)
