/**
 * 与框架无关的图片扫描 + ZIP 打包库
 * 依赖：jszip、file-saver（需在外部引入，或打包时 external）
 */
import JSZip from "jszip";
//@ts-ignore
import { saveAs } from "file-saver";

import { ImageInfo } from "@/types/utils";

// 下载选项接口
export interface DownloadOptions {
  onProgress?: (progress: number) => void;
  fileName?: string;
}

const fetchImageBlob = async (src: string): Promise<Blob> => {
  if (src.startsWith("data:image")) {
    return fetch(src).then((r) => r.blob());
  }
  const res = await fetch(src);
  if (!res.ok) {
    throw new Error(`fetch error ${res.status}`);
  }
  return res.blob();
};

const buildImageInfo = (
  src: string,
  idx: number,
  element: Element,
  alt: string,
  prefix = "image",
): ImageInfo => {
  const isBase64 = src.startsWith("data:image");
  const ext = getExt(src);
  return {
    src,
    alt: alt || `${prefix}_${idx + 1}`,
    isBase64,
    element,
    name: isBase64
      ? `base64_${prefix}_${idx + 1}.${ext}`
      : getFileName(src, idx, prefix),
  };
};

const scanImgTags = (root: ParentNode): ImageInfo[] =>
  Array.from(root.querySelectorAll("img")).reduce(
    (list, img, idx) =>
      img.src
        ? (list.push(buildImageInfo(img.src, idx, img, img.alt, "image")), list)
        : list,
    [] as ImageInfo[],
  );

const scanBackgroundImages = (
  root: ParentNode,
  startIdx: number,
): ImageInfo[] => {
  const list: ImageInfo[] = [];
  let bgIdx = startIdx;
  root.querySelectorAll("*").forEach((el) => {
    const urlMatch = window
      .getComputedStyle(el)
      .backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!urlMatch) {
      return;
    }
    list.push(
      buildImageInfo(urlMatch[1], bgIdx++, el, "background-image", "bg"),
    );
  });
  return list;
};

/**
 * 扫描指定根节点下的所有图片资源（包括Base64和CSS背景图片）
 * @param root  document | shadowRoot | Element
 * @returns 图片列表
 */
export function scanImages(root: ParentNode = document): ImageInfo[] {
  const imgTags = scanImgTags(root);
  const bgImages = scanBackgroundImages(root, imgTags.length);
  return imgTags.concat(bgImages);
}

/**
 * 批量下载并打包成 ZIP（支持Base64图片）
 * @param images   scanImages 的结果
 * @param opt 下载选项
 * @returns Promise<void>
 */
export async function downloadAllImages(
  images: ImageInfo[],
  opt: DownloadOptions = {},
): Promise<void> {
  const { onProgress = () => {}, fileName = "images.zip" } = opt;
  const zip = new JSZip();
  const total = images.length;

  if (total === 0) {
    throw new Error("没有可下载的图片");
  }

  let done = 0;

  for (const { src, name } of images) {
    try {
      zip.file(name || src, await fetchImageBlob(src), { binary: true });
    } catch (e: any) {
      maLogger.warn(`[image-zip-downloader] 跳过资源: ${src}`, e);
    }
    done++;
    onProgress(Math.round((done / total) * 100));
  }

  const zipBlob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    },
    (metadata) => {
      onProgress(Math.round(metadata.percent));
    },
  );

  saveAs(zipBlob, fileName);
}

/**
 * 从URL中提取文件扩展名
 * @param url 图片URL
 * @returns 文件扩展名
 */
function getExt(url: string): string {
  // 对于Base64图片，从data URL中提取MIME类型
  if (url.startsWith("data:image")) {
    const mimeMatch = url.match(/data:image\/(\w+);/);
    return mimeMatch ? mimeMatch[1] : "png";
  }

  // 对于普通URL，从路径中提取扩展名
  const m = url.match(/\.(jpeg|jpg|gif|png|bmp|webp|svg)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "jpg";
}

/**
 * 生成更友好的文件名
 * @param url 图片URL
 * @param idx 索引
 * @param prefix 前缀
 * @returns 文件名
 */
function getFileName(
  url: string,
  idx: number,
  prefix: string = "image",
): string {
  // 尝试从URL中提取有意义的文件名
  const urlObj = new URL(url, window.location.href);
  const pathname = urlObj.pathname;
  const lastSegment = pathname.split("/").pop();

  // 如果URL中有文件名，使用它
  if (lastSegment && lastSegment.includes(".")) {
    return lastSegment;
  }

  // 否则使用索引作为文件名
  const ext = getExt(url);
  return `${prefix}_${idx + 1}.${ext}`;
}

/**
 * 单独下载一张图片
 * @param src 图片URL
 * @param name 文件名（可选）
 * @returns Promise<void>
 */
export async function downloadSingleImage(
  src: string,
  name: string | null = null,
): Promise<void> {
  try {
    const blob = await fetchImageBlob(src);
    const fileName = name || `image_${Date.now()}.${getExt(src)}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error: any) {
    maLogger.error("下载图片失败:", error);
    throw error;
  }
}
