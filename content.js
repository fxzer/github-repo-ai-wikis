// ==UserScript==
// @name         Github Repo AI Wikis
// @namespace    http://tampermonkey.net/
// @version      2.1.4
// @description  Adds a quick access dropdown on GitHub repo pages to navigate to DeepWiki, ZreadAI, and ReadmeX.
// @author       fxzer
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

  // --- 获取挂载容器 ---
  function getTargetContainer() {
    return (
      document.querySelector('[data-testid="repo-header-actions"]') ||
      document.querySelector('ul.pagehead-actions') ||
      document.querySelector('#repository-container-header ul') ||
      document.querySelector('[data-testid="star-button"]')?.closest('ul') ||
      document.querySelector('#repo-stars-counter-star')?.closest('ul')
    );
  }

  // --- DOM 操作 ---
  function observeDOM() {
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        onUrlChange();
      } else {
        injectComponent();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 监听 Turbo 与浏览器导航事件
    ['turbo:load', 'turbo:render', 'pjax:end', 'popstate'].forEach(eventType => {
      window.addEventListener(eventType, () => {
        currentPath = window.location.pathname;
        onUrlChange();
      });
    });

    onUrlChange(); // 首次加载时运行
  }

  function onUrlChange() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      owner = pathParts[0];
      repo = pathParts[1];
      injectComponent();
    } else {
      removeComponent();
    }
  }

  function injectComponent() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) {
      removeComponent();
      return;
    }

    const currentOwner = pathParts[0];
    const currentRepo = pathParts[1];

    const targetContainer = getTargetContainer();
    if (!targetContainer) {
      return;
    }

    let component = document.querySelector('.dqa-container');
    if (component) {
      // 若容器位置改变或脱离目标父级，重新插入
      if (component.parentElement !== targetContainer) {
        targetContainer.insertBefore(component, targetContainer.firstChild);
      }
      // 若仓库发生变化，更新 URL 和按钮
      if (owner !== currentOwner || repo !== currentRepo) {
        owner = currentOwner;
        repo = currentRepo;
        updateUI();
      }
      return;
    }

    owner = currentOwner;
    repo = currentRepo;
    component = createComponent();
    targetContainer.insertBefore(component, targetContainer.firstChild);
  }

  function removeComponent() {
    const existingComponent = document.querySelector('.dqa-container');
    if (existingComponent) {
      existingComponent.remove();
    }
  }

  function closeDropdown() {
    const container = document.querySelector('.dqa-container');
    if (container) {
      container.classList.remove('open');
      document.removeEventListener('click', onOutsideClick);
    }
  }

  function onOutsideClick(event) {
    const container = document.querySelector('.dqa-container');
    if (container && !container.contains(event.target)) {
      closeDropdown();
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
    dropdownTrigger.innerHTML = `<svg aria-hidden="true" focusable="false" class="octicon octicon-triangle-down" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align: text-bottom;"><path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path></svg>`;
    dropdownTrigger.onclick = e => {
      e.stopPropagation();
      const isOpen = container.classList.toggle('open');
      if (isOpen) {
        document.addEventListener('click', onOutsideClick);
      } else {
        document.removeEventListener('click', onOutsideClick);
      }
    };

    // 下拉菜单
    const dropdownMenu = createDropdownMenu();

    btnGroup.append(mainBtn, dropdownTrigger);
    container.append(btnGroup, dropdownMenu);

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
      pinBtn.title = pinnedService === service.name ? '已置顶' : `置顶 ${service.name}`;
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
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get('pinnedService');
        pinnedService = data.pinnedService || DEFAULT_SERVICE;
      } else if (typeof GM_getValue !== 'undefined') {
        pinnedService = GM_getValue('pinnedService', DEFAULT_SERVICE);
      } else {
        pinnedService = localStorage.getItem('dqa_pinnedService') || DEFAULT_SERVICE;
      }
    } catch (e) {
      console.error('Failed to load pinned service:', e);
      pinnedService = DEFAULT_SERVICE;
    }
  }

  async function setPinnedService(serviceName) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ pinnedService: serviceName });
      } else if (typeof GM_setValue !== 'undefined') {
        GM_setValue('pinnedService', serviceName);
      } else {
        localStorage.setItem('dqa_pinnedService', serviceName);
      }
      pinnedService = serviceName;
      updateUI();
      closeDropdown();
    } catch (e) {
      console.error('Failed to save pinned service:', e);
    }
  }

  // --- 启动 ---
  init();
})();
