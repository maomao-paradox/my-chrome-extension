const PORTION_MODE_RETAIN = 'retain';
const PORTION_MODE_FIRST = 'first';

type PortionMode = typeof PORTION_MODE_RETAIN | typeof PORTION_MODE_FIRST;

interface MatchInfo {
  [index: number]: string;
  0: string;
  input: string;
  index: number;
  startIndex: number;
  endIndex: number;
}

interface Portion {
  node: Text;
  index: number;
  text: string;
  indexInMatch: number;
  indexInNode: number;
  endIndexInNode?: number;
  isEnd?: boolean;
}

interface FinderOptions {
  find: RegExp | string;
  wrap?: string | HTMLElement;
  wrapClass?: string;
  replace?: string | ((portion: Portion, match: MatchInfo) => string | Node);
  filterElements?: (el: Element) => boolean;
  forceContext?: boolean | ((el: Element) => boolean);
  portionMode?: PortionMode;
  preset?: string;
  prepMatch?: (match: MatchInfo, matchIndex: number, characterOffset: number) => MatchInfo;
}

interface RevertFunction {
  (): void;
}

const NON_PROSE_ELEMENTS: Record<string, 1> = {
  br: 1, hr: 1,
  script: 1, style: 1, img: 1, video: 1, audio: 1, canvas: 1, svg: 1, map: 1, object: 1,
  input: 1, textarea: 1, select: 1, option: 1, optgroup: 1, button: 1
};

const NON_CONTIGUOUS_PROSE_ELEMENTS: Record<string, 1> = {
  address: 1, article: 1, aside: 1, blockquote: 1, dd: 1, div: 1,
  dl: 1, fieldset: 1, figcaption: 1, figure: 1, footer: 1, form: 1, h1: 1, h2: 1, h3: 1,
  h4: 1, h5: 1, h6: 1, header: 1, hgroup: 1, hr: 1, main: 1, nav: 1, noscript: 1, ol: 1,
  output: 1, p: 1, pre: 1, section: 1, ul: 1,
  br: 1, li: 1, summary: 1, dt: 1, details: 1, rp: 1, rt: 1, rtc: 1,
  script: 1, style: 1, img: 1, video: 1, audio: 1, canvas: 1, svg: 1, map: 1, object: 1,
  input: 1, textarea: 1, select: 1, option: 1, optgroup: 1, button: 1,
  table: 1, tbody: 1, thead: 1, th: 1, tr: 1, td: 1, caption: 1, col: 1, tfoot: 1, colgroup: 1
};

const hasOwn = {}.hasOwnProperty;

function escapeRegExp(s: string): string {
  return String(s).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
}

function NON_INLINE_PROSE(el: Element): boolean {
  return hasOwn.call(NON_CONTIGUOUS_PROSE_ELEMENTS, el.nodeName.toLowerCase());
}

const PRESETS: Record<string, Record<string, unknown>> = {
  prose: {
    forceContext: NON_INLINE_PROSE,
    filterElements: function(el: Element) {
      return !hasOwn.call(NON_PROSE_ELEMENTS, el.nodeName.toLowerCase());
    }
  }
};

class Finder {
  private node: Node;
  private options: FinderOptions;
  private prepMatch: (match: MatchInfo, matchIndex: number, characterOffset: number) => MatchInfo;
  private reverts: RevertFunction[] = [];
  matches: MatchInfo[];

  constructor(node: Node, options: FinderOptions) {
    const preset = options.preset && PRESETS[options.preset];

    options.portionMode = options.portionMode || PORTION_MODE_RETAIN;

    if (preset) {
      for (const i in preset) {
        if (hasOwn.call(preset, i) && !hasOwn.call(options, i)) {
          (options as unknown as Record<string, unknown>)[i] = preset[i];
        }
      }
    }

    this.node = node;
    this.options = options;
    this.prepMatch = options.prepMatch || this.defaultPrepMatch;
    this.matches = this.search();

    if (this.matches.length) {
      this.processMatches();
    }
  }

  private defaultPrepMatch(match: MatchInfo, matchIndex: number, characterOffset: number): MatchInfo {
    if (!match[0]) {
      throw new Error('findAndReplaceDOMText cannot handle zero-length matches');
    }

    match.endIndex = characterOffset + match.index + match[0].length;
    match.startIndex = characterOffset + match.index;
    match.index = matchIndex;

    return match;
  }

  private search(): MatchInfo[] {
    let match: RegExpExecArray | null;
    let matchIndex = 0;
    let offset = 0;
    const regex = this.options.find;
    const textAggregation = this.getAggregateText();
    const matches: MatchInfo[] = [];
    const self = this;

    const reg = typeof regex === 'string' ? new RegExp(escapeRegExp(regex), 'g') : regex;

    function matchAggregation(textAggregation: (string | unknown[])[]): void {
      for (let i = 0, l = textAggregation.length; i < l; ++i) {
        const text = textAggregation[i];

        if (typeof text !== 'string') {
          matchAggregation(text as (string | unknown[])[]);
          continue;
        }

        if (reg.global) {
          while ((match = reg.exec(text)) !== null) {
            matches.push(self.prepMatch(match as unknown as MatchInfo, matchIndex++, offset));
          }
        } else {
          const matched = text.match(reg);
          if (matched) {
            matches.push(self.prepMatch(matched as unknown as MatchInfo, 0, offset));
          }
        }

        offset += text.length;
      }
    }

    matchAggregation(textAggregation);

    return matches;
  }

  private getAggregateText(): (string | unknown[])[] {
    const elementFilter = this.options.filterElements;
    const forceContext = this.options.forceContext;

    const getText = (node: Node): (string | unknown[])[] => {
      if (node.nodeType === Node.TEXT_NODE) {
        return [(node as Text).data];
      }

      if (elementFilter && !elementFilter(node as Element)) {
        return [];
      }

      const txt: (string | unknown[])[] = [''];
      let i = 0;

      let currentNode = node.firstChild;
      do {
        if (!currentNode) break;

        if (currentNode.nodeType === Node.TEXT_NODE) {
          txt[i] = (txt[i] as string) + (currentNode as Text).data;
          continue;
        }

        const innerText = getText(currentNode);

        if (
          forceContext &&
          currentNode.nodeType === Node.ELEMENT_NODE &&
          (forceContext === true || forceContext(currentNode as Element))
        ) {
          txt[++i] = innerText;
          txt[++i] = '';
        } else {
          if (typeof innerText[0] === 'string') {
            txt[i] = (txt[i] as string) + innerText.shift();
          }
          if (innerText.length) {
            txt[++i] = innerText;
            txt[++i] = '';
          }
        }
      } while ((currentNode = currentNode.nextSibling));

      return txt;
    };

    return getText(this.node);
  }

  private processMatches(): void {
    const matches = this.matches;
    const node = this.node;
    const elementFilter = this.options.filterElements;

    let startPortion: Portion | null = null;
    let endPortion: Portion | null = null;
    const innerPortions: Portion[] = [];
    let curNode: Node | null = node;
    let match = matches.shift();
    let atIndex = 0;
    let matchIndex = 0;
    let portionIndex = 0;
    let doAvoidNode = false;
    const nodeStack: Node[] = [node];

    out: while (true) {
      if (!curNode) break;

      if (curNode.nodeType === Node.TEXT_NODE) {
        const textNode = curNode as Text;
        if (!endPortion && textNode.length + atIndex >= match!.endIndex) {
          endPortion = {
            node: textNode,
            index: portionIndex++,
            text: textNode.data.substring(match!.startIndex - atIndex, match!.endIndex - atIndex),
            indexInMatch: atIndex === 0 ? 0 : atIndex - match!.startIndex,
            indexInNode: match!.startIndex - atIndex,
            endIndexInNode: match!.endIndex - atIndex,
            isEnd: true
          };
        } else if (startPortion) {
          innerPortions.push({
            node: textNode,
            index: portionIndex++,
            text: textNode.data,
            indexInMatch: atIndex - match!.startIndex,
            indexInNode: 0
          });
        }

        if (!startPortion && textNode.length + atIndex > match!.startIndex) {
          startPortion = {
            node: textNode,
            index: portionIndex++,
            indexInMatch: 0,
            indexInNode: match!.startIndex - atIndex,
            endIndexInNode: match!.endIndex - atIndex,
            text: textNode.data.substring(match!.startIndex - atIndex, match!.endIndex - atIndex)
          };
        }

        atIndex += textNode.data.length;
      }

      doAvoidNode = curNode.nodeType === Node.ELEMENT_NODE && !!elementFilter && !elementFilter(curNode as Element);

      if (startPortion && endPortion) {
        curNode = this.replaceMatch(match!, startPortion, innerPortions, endPortion);

        atIndex -= (endPortion.node.data.length - endPortion.endIndexInNode!);

        startPortion = null;
        endPortion = null;
        innerPortions.length = 0;
        match = matches.shift();
        portionIndex = 0;
        matchIndex++;

        if (!match) {
          break;
        }
      } else if (
        !doAvoidNode &&
        (curNode.firstChild || curNode.nextSibling)
      ) {
        if (curNode.firstChild) {
          nodeStack.push(curNode);
          curNode = curNode.firstChild;
        } else {
          curNode = curNode.nextSibling;
        }
        continue;
      }

      while (true) {
        if (curNode.nextSibling) {
          curNode = curNode.nextSibling;
          break;
        }
        const parentNode = nodeStack.pop();
        if (!parentNode || parentNode === node) {
          break out;
        }
        curNode = parentNode;
      }
    }
  }

  revert(): void {
    for (let l = this.reverts.length; l--;) {
      this.reverts[l]();
    }
    this.reverts = [];
  }

  private prepareReplacementString(string: string, portion: Portion, match: MatchInfo): string {
    const portionMode = this.options.portionMode;
    if (
      portionMode === PORTION_MODE_FIRST &&
      portion.indexInMatch > 0
    ) {
      return '';
    }

    string = string.replace(/\$(\d+|&|`|')/g, function($0: string, t: string): string {
      let replacement: string;
      switch (t) {
        case '&':
          replacement = match[0];
          break;
        case '`':
          replacement = match.input.substring(0, match.startIndex);
          break;
        case '\'':
          replacement = match.input.substring(match.endIndex);
          break;
        default:
          replacement = match[+t] || '';
      }
      return replacement;
    });

    if (portionMode === PORTION_MODE_FIRST) {
      return string;
    }

    if (portion.isEnd) {
      return string.substring(portion.indexInMatch);
    }

    return string.substring(portion.indexInMatch, portion.indexInMatch + portion.text.length);
  }

  private getPortionReplacementNode(portion: Portion, match: MatchInfo): Node {
    const replacement = this.options.replace || '$&';
    const wrapper = this.options.wrap;
    const wrapperClass = this.options.wrapClass;

    let wrapperEl: Element | null = null;

    if (wrapper && (wrapper as HTMLElement).nodeType) {
      const clone = document.createElement('div');
      clone.innerHTML = (wrapper as HTMLElement).outerHTML || new XMLSerializer().serializeToString(wrapper as HTMLElement);
      wrapperEl = clone.firstChild as Element;
    }

    if (typeof replacement === 'function') {
      const result = replacement(portion, match);
      if (result && (result as Node).nodeType) {
        return result as Node;
      }
      return document.createTextNode(String(result));
    }

    if (typeof wrapper === 'string') {
      wrapperEl = document.createElement(wrapper);
    }

    if (wrapperEl && wrapperClass) {
      wrapperEl.className = wrapperClass;
    }

    const textReplacement = document.createTextNode(
      this.prepareReplacementString(replacement as string, portion, match)
    );

    if (!textReplacement.data) {
      return textReplacement;
    }

    if (!wrapperEl) {
      return textReplacement;
    }

    wrapperEl.appendChild(textReplacement);

    return wrapperEl;
  }

  private replaceMatch(match: MatchInfo, startPortion: Portion, innerPortions: Portion[], endPortion: Portion): Node {
    const matchStartNode = startPortion.node;
    const matchEndNode = endPortion.node;

    let precedingTextNode: Text | null = null;
    let followingTextNode: Text | null = null;

    if (matchStartNode === matchEndNode) {
      const node = matchStartNode;

      if (startPortion.indexInNode > 0) {
        precedingTextNode = document.createTextNode(node.data.substring(0, startPortion.indexInNode));
        node.parentNode!.insertBefore(precedingTextNode, node);
      }

      const newNode = this.getPortionReplacementNode(endPortion, match);

      node.parentNode!.insertBefore(newNode, node);

      if (endPortion.endIndexInNode! < node.length) {
        followingTextNode = document.createTextNode(node.data.substring(endPortion.endIndexInNode!));
        node.parentNode!.insertBefore(followingTextNode, node);
      }

      node.parentNode!.removeChild(node);

      this.reverts.push(() => {
        if (precedingTextNode && precedingTextNode === newNode.previousSibling) {
          precedingTextNode.parentNode!.removeChild(precedingTextNode);
        }
        if (followingTextNode && followingTextNode === newNode.nextSibling) {
          followingTextNode.parentNode!.removeChild(followingTextNode);
        }
        newNode.parentNode!.replaceChild(node, newNode);
      });

      return newNode;
    } else {
      precedingTextNode = document.createTextNode(
        matchStartNode.data.substring(0, startPortion.indexInNode)
      );

      followingTextNode = document.createTextNode(
        matchEndNode.data.substring(endPortion.endIndexInNode!)
      );

      const firstNode = this.getPortionReplacementNode(startPortion, match);

      const innerNodes: Node[] = [];

      for (let i = 0, l = innerPortions.length; i < l; ++i) {
        const portion = innerPortions[i];
        const innerNode = this.getPortionReplacementNode(portion, match);
        portion.node.parentNode!.replaceChild(innerNode, portion.node);
        this.reverts.push((function(portionNode, innerNodeRef) {
          return function() {
            innerNodeRef.parentNode!.replaceChild(portionNode, innerNodeRef);
          };
        })(portion.node, innerNode));
        innerNodes.push(innerNode);
      }

      const lastNode = this.getPortionReplacementNode(endPortion, match);

      matchStartNode.parentNode!.insertBefore(precedingTextNode, matchStartNode);
      matchStartNode.parentNode!.insertBefore(firstNode, matchStartNode);
      matchStartNode.parentNode!.removeChild(matchStartNode);

      matchEndNode.parentNode!.insertBefore(lastNode, matchEndNode);
      matchEndNode.parentNode!.insertBefore(followingTextNode, matchEndNode);
      matchEndNode.parentNode!.removeChild(matchEndNode);

      this.reverts.push(() => {
        if (precedingTextNode) {
          precedingTextNode.parentNode!.removeChild(precedingTextNode);
        }
        firstNode.parentNode!.replaceChild(matchStartNode, firstNode);
        if (followingTextNode) {
          followingTextNode.parentNode!.removeChild(followingTextNode);
        }
        lastNode.parentNode!.replaceChild(matchEndNode, lastNode);
      });

      return lastNode;
    }
  }
}

function findAndReplaceDOMText(node: Node, options: FinderOptions): Finder {
  return new Finder(node, options);
}

findAndReplaceDOMText.NON_PROSE_ELEMENTS = NON_PROSE_ELEMENTS;
findAndReplaceDOMText.NON_CONTIGUOUS_PROSE_ELEMENTS = NON_CONTIGUOUS_PROSE_ELEMENTS;
findAndReplaceDOMText.NON_INLINE_PROSE = NON_INLINE_PROSE;
findAndReplaceDOMText.PRESETS = PRESETS;
findAndReplaceDOMText.Finder = Finder;

export {
  Finder,
  type FinderOptions,
  type MatchInfo,
  type Portion,
  type PortionMode,
  NON_PROSE_ELEMENTS,
  NON_CONTIGUOUS_PROSE_ELEMENTS,
  NON_INLINE_PROSE,
  PRESETS,
  PORTION_MODE_RETAIN,
  PORTION_MODE_FIRST
};

export default findAndReplaceDOMText;