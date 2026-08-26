void function() {
  window.__bookmarkHighlight__ = (bookmark) => {
    window.scrollTo(bookmark.scrollPosition.x, bookmark.scrollPosition.y);

    function highlightText(text) {
      const oldHighlights = document.querySelectorAll('.bookmark-highlight');
      oldHighlights.forEach(el => {
        el.parentNode?.replaceChild(document.createTextNode(el.textContent || ''), el);
      });

      if (!text) {
        return;
      }

      function getBackgroundBrightness(element) {
        if (!element) {
          return 255;
        }

        const style = window.getComputedStyle(element);
        const rgbMatch = style.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbMatch) {
          return (parseInt(rgbMatch[1]) * 299 + parseInt(rgbMatch[2]) * 587 + parseInt(rgbMatch[3]) * 114) / 1000;
        }

        return getBackgroundBrightness(element.parentElement);
      }

      const style = document.createElement('style');
      style.textContent = `
				.bookmark-highlight {
					padding: 2px 4px; border-radius: 2px;
					animation: highlight-pulse 2s ease-in-out;
				}
				.bookmark-highlight.light-bg { background-color: #ffff00; color: #000; }
				.bookmark-highlight.dark-bg { background-color: #ff6b6b; color: #fff; }
				@keyframes highlight-pulse {
					0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; }
				}
			`;
      document.head.appendChild(style);

      function findAndHighlight(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeText = node.textContent || '';
          const index = nodeText.indexOf(text);
          if (index === -1) {
            return false;
          }

          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + text.length);

          const span = document.createElement('span');
          span.className = 'bookmark-highlight ' + (
            getBackgroundBrightness(node.parentElement) < 128 ? 'dark-bg' : 'light-bg'
          );
          span.textContent = nodeText.substring(index, index + text.length);

          range.deleteContents();
          range.insertNode(span);
          span.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }

        if (node.nodeType === Node.ELEMENT_NODE && !['SCRIPT', 'STYLE'].includes(node.tagName)) {
          for (let i = 0; i < node.childNodes.length; i++) {
            if (findAndHighlight(node.childNodes[i])) {
              return true;
            }
          }
        }

        return false;
      }

      findAndHighlight(document.body);
    }

    highlightText(bookmark.text.replace(/'/g, "\'"));
  };
} ();