// ==UserScript==
// @name         Github Repo AI Wikis
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds a quick access dropdown on GitHub repo pages to navigate to DeepWiki, ZreadAI, and ReadmeX.
// @author       You
// @match        https://github.com/*/*
// @grant        chrome.storage.local
// ==/UserScript==

(function () {
  'use strict';

  // --- 配置 ---
  const SERVICES = {
    DeepWiki: {
      name: 'DeepWiki',
      urlTemplate: 'https://deepwiki.com/{owner}/{repo}',
      icon: ICONS.DEEPWIKI,
    },
    ZreadAI: {
      name: 'ZreadAI',
      urlTemplate: 'https://zread.ai/{owner}/{repo}',
      icon: ICONS.ZREAD,
    },
    ReadmeX: {
      name: 'ReadmeX',
      urlTemplate: 'https://readmex.com/{owner}/{repo}',
      icon: ICONS.READMEX,
    },
  };
  const DEFAULT_SERVICE = 'DeepWiki';

  // --- 状态 ---
  let currentPath = window.location.pathname;
  let owner, repo;
  let pinnedService = DEFAULT_SERVICE;

  // --- 主函数 ---
  async function init() {
    await loadPinnedService();
    observeDOM();
  }

  // --- DOM 操作 ---
  function observeDOM() {
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        onUrlChange();
      }
      injectComponent();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    onUrlChange(); // 首次加载时运行
  }

  function onUrlChange() {
    const pathParts = window.location.pathname.split('/').filter(part => part);
    if (pathParts.length >= 2) {
      owner = pathParts[0];
      repo = pathParts[1];
      injectComponent();
    } else {
      removeComponent();
    }
  }

  function injectComponent() {
    const targetContainer = document.querySelector('ul.pagehead-actions');
    if (!targetContainer || document.querySelector('.dqa-container')) {
      return; // 目标不存在或已注入
    }

    const component = createComponent();
    targetContainer.insertBefore(component, targetContainer.firstChild);
  }

  function removeComponent() {
    const existingComponent = document.querySelector('.dqa-container');
    if (existingComponent) {
      existingComponent.remove();
    }
  }

  function createComponent() {
    const container = document.createElement('li');
    container.className = 'dqa-container';

    const btnGroup = document.createElement('div');
    btnGroup.className = 'dqa-btn-group';

    // 主按钮
    const mainBtn = document.createElement('a');
    mainBtn.className = 'dqa-main-btn';
    updateMainButton(mainBtn);

    // 下拉触发器
    const dropdownTrigger = document.createElement('div');
    dropdownTrigger.className = 'dqa-dropdown-trigger';
    dropdownTrigger.innerHTML = `<svg aria-hidden="true" focusable="false" class="octicon octicon-triangle-down" viewBox="0 0 16 16" width="16" height="16" fill="currentPath" display="inline-block" overflow="visible" style="vertical-align: text-bottom;"><path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path></svg>`;
    dropdownTrigger.onclick = e => {
      e.stopPropagation();
      const isOpen = container.classList.toggle('open');
      if (isOpen) {
        // 添加全局点击监听
        document.addEventListener('click', onOutsideClick);
      } else {
        document.removeEventListener('click', onOutsideClick);
      }
      function onOutsideClick(event) {
        if (!container.contains(event.target)) {
          container.classList.remove('open');
          document.removeEventListener('click', onOutsideClick);
        }
      }
    };

    // 下拉菜单
    const dropdownMenu = createDropdownMenu();

    btnGroup.append(mainBtn, dropdownTrigger);
    container.append(btnGroup, dropdownMenu);

    // 移除原有的点击外部关闭逻辑（已在trigger里处理）

    return container;
  }

  function createDropdownMenu() {
    const menu = document.createElement('div');
    menu.className = 'dqa-dropdown-menu';

    const header = document.createElement('div');
    header.className = 'dqa-dropdown-header';
    header.textContent = '源码解读';
    menu.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'dqa-dropdown-list';

    for (const serviceKey in SERVICES) {
      const service = SERVICES[serviceKey];
      const item = document.createElement('li');
      item.className = 'dqa-dropdown-item';

      const link = document.createElement('a');
      link.className = 'dqa-item-link';
      link.href = service.urlTemplate
        .replace('{owner}', owner)
        .replace('{repo}', repo);
      link.target = '_blank';
      link.innerHTML = `${service.icon} <span>${service.name}</span>`;

      const pinBtn = document.createElement('button');
      pinBtn.className = 'dqa-pin-btn';
      pinBtn.innerHTML =
        pinnedService === service.name ? ICONS.PIN_FILLED : ICONS.PIN;
      if (pinnedService === service.name) {
        pinBtn.classList.add('pinned');
      }
      pinBtn.onclick = e => {
        e.stopPropagation();
        setPinnedService(service.name);
      };

      item.append(link, pinBtn);
      list.appendChild(item);
    }

    menu.appendChild(list);
    return menu;
  }

  // --- 状态更新 & 重新渲染 ---
  function updateUI() {
    const container = document.querySelector('.dqa-container');
    if (!container) return;

    const mainBtn = container.querySelector('.dqa-main-btn');
    if (mainBtn) {
      updateMainButton(mainBtn);
    }

    const oldMenu = container.querySelector('.dqa-dropdown-menu');
    if (oldMenu) {
      const newMenu = createDropdownMenu();
      oldMenu.replaceWith(newMenu);
    }
  }

  function updateMainButton(buttonElement) {
    const service = SERVICES[pinnedService];
    if (!service) return;
    buttonElement.href = service.urlTemplate
      .replace('{owner}', owner)
      .replace('{repo}', repo);
    buttonElement.target = '_blank';
    buttonElement.title = `在 ${service.name} 中查看此项目`;
    buttonElement.innerHTML = `${service.icon} <span>${service.name}</span>`;
  }

  // --- 数据持久化 ---
  async function loadPinnedService() {
    try {
      const data = await chrome.storage.local.get('pinnedService');
      pinnedService = data.pinnedService || DEFAULT_SERVICE;
    } catch (e) {
      console.error('Failed to load pinned service:', e);
      pinnedService = DEFAULT_SERVICE;
    }
  }

  async function setPinnedService(serviceName) {
    try {
      await chrome.storage.local.set({ pinnedService: serviceName });
      pinnedService = serviceName;
      updateUI();
      document.querySelector('.dqa-container')?.classList.remove('open');
    } catch (e) {
      console.error('Failed to save pinned service:', e);
    }
  }

  // --- 启动 ---
  init();
})();
