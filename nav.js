/* nav.js — shared navigation for every RomitCSV page. */
(function(){
  function closeDropdowns(nav){
    nav.querySelectorAll('.nav-dropdown').forEach(function(dd){
      dd.classList.remove('open');
      var btn=dd.querySelector('.nav-drop-btn');
      if(btn) btn.setAttribute('aria-expanded','false');
    });
  }
  function closeMenus(){
    document.querySelectorAll('.site-header').forEach(function(header){
      var nav=header.querySelector('nav');
      var menu=header.querySelector('.menu-btn');
      if(nav){nav.classList.remove('open');closeDropdowns(nav)}
      if(menu){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu')}
    });
  }
  function init(){
    document.querySelectorAll('.site-header').forEach(function(header){
      var nav=header.querySelector('nav');
      var menu=header.querySelector('.menu-btn');
      if(!nav) return;
      if(menu){
        menu.setAttribute('aria-expanded','false');
        menu.addEventListener('click',function(e){
          e.preventDefault();e.stopPropagation();
          var willOpen=!nav.classList.contains('open');
          document.querySelectorAll('.site-header nav.open').forEach(function(other){
            if(other!==nav){
              other.classList.remove('open');closeDropdowns(other);
              var otherMenu=other.closest('.site-header')?.querySelector('.menu-btn');
              if(otherMenu){otherMenu.setAttribute('aria-expanded','false');otherMenu.setAttribute('aria-label','Open menu')}
            }
          });
          nav.classList.toggle('open',willOpen);
          if(!willOpen) closeDropdowns(nav);
          menu.setAttribute('aria-expanded',String(willOpen));
          menu.setAttribute('aria-label',willOpen?'Close menu':'Open menu');
        });
      }
      nav.querySelectorAll('.nav-dropdown').forEach(function(dd){
        var btn=dd.querySelector('.nav-drop-btn');
        if(!btn) return;
        btn.addEventListener('click',function(e){
          e.preventDefault();e.stopPropagation();
          var isOpen=dd.classList.contains('open');
          closeDropdowns(nav);
          if(!isOpen){dd.classList.add('open');btn.setAttribute('aria-expanded','true')}
        });
      });
      nav.querySelectorAll('a').forEach(function(link){
        link.addEventListener('click',function(){if(window.innerWidth<=900) closeMenus()});
      });
    });
    document.addEventListener('click',function(){closeMenus()});
    document.addEventListener('keydown',function(e){if(e.key==='Escape') closeMenus()});
    window.addEventListener('resize',function(){if(window.innerWidth>900) closeMenus()});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
