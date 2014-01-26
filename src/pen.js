/*! Licensed under MIT, https://github.com/sofish/pen */
/* jshint -W030, -W093, -W015 */
jQuery(document).ready(function($) {

  var Pen, FakePen, utils = {};
  var iconUnicode = {'location':'&#x\uf041',
                'fit':'\uf066',
                'bold':'\uf032',
                'italic':'\uf033',
                'justifyleft':'\uf036',
                'justifycenter':'\uf037',
                'justifyright':'\uf038',
                'justifyfull':'\uf039',
                'outdent':'\uf03b',
                'indent':'\uf03c',
                'mode':'\uf042',
                'fullscreen':'\uf0b2',
                'insertunorderedlist':'\uf0ca',
                'insertorderedlist':'\uf0cb',
                'strikethrough':'\uf0cc',
                'underline':'\uf0cd',
                'blockquote':'\uf10d',
                'undo':'\uf0e2',
                'pre':'\uf121',
                'unlink':'\uf127',
                'superscript':'\uf12b',
                'subscript':'\uf12c',
                'inserthorizontalrule':'\uf141',
                'pin':'\uf0c6',
                'createlink':'\uf0c1',
                'keyword':'\uf084',
                'property-name':'\uf044'}
  // type detect
  utils.is = function(obj, type) {
    return Object.prototype.toString.call(obj).slice(8, -1) === type;
  };

  // copy props from a obj
  utils.copy = function(defaults, source) {
    for(var p in source) {
      if(source.hasOwnProperty(p)) {
        var val = source[p];
        defaults[p] = this.is(val, 'Object') ? this.copy({}, val) :
          this.is(val, 'Array') ? this.copy([], val) : val;
      }
    }
    return defaults;
  };

  // log
  utils.log = function(message, force) {
    if(window._pen_debug_mode_on || force) console.log('%cPEN DEBUGGER: %c' + message, 'font-family:arial,sans-serif;color:#1abf89;line-height:2em;', 'font-family:cursor,monospace;color:#333;');
  };

  // shift a function
  utils.shift = function(key, fn, time) {
    time = time || 50;
    var queue = this['_shift_fn' + key], timeout = 'shift_timeout' + key, current;
    queue ? queue.concat([fn, time]) : (queue = [[fn, time]]);
    current = queue.pop();
    clearTimeout(this[timeout]);
    this[timeout] = setTimeout(function() {
      current[0]();
    }, time);
  };

  // merge: make it easy to have a fallback
  utils.merge = function(config) {

    // default settings
    var defaults = {
      className: 'pen',
      debug: false,
      stay: config.stay || !config.debug,
      textarea: '<textarea name="content"></textarea>',
      list: [
        'blockquote', 'insertorderedlist', 'insertunorderedlist', 'indent',
         'outdent', 'bold', 'italic', 'underline', 'createlink'
      ]
    };

    // user-friendly config
    if(config.nodeType === 1) {
      defaults.editor = config;
    } else if(config.match && config.match(/^#[\S]+$/)) {
      defaults.editor = document.getElementById(config.slice(1));
    } else {
      defaults = utils.copy(defaults, config);
    }

    return defaults;
  };

  Pen = function(config) {

    if(!config) return utils.log('can\'t find config', true);

    // merge user config
    var defaults = utils.merge(config);
    if(defaults.editor.nodeType !== 1) return utils.log('can\'t find editor');
    if(defaults.debug) window._pen_debug_mode_on = true;

    var editor = defaults.editor;

    // set default className
    editor.classList.add(defaults.className);

    // set contenteditable
    var editable = editor.getAttribute('contenteditable');
    if(!editable) editor.setAttribute('contenteditable', 'true');

    // assign config
    this.config = defaults;

    // save the selection obj
    this._sel = document.getSelection();
    this._eventHandlers = [];
    // map actions
    this.actions();

    // enable toolbar
    this.toolbar();

    // enable markdown covert
    this.markdown && this.markdown.init(this);

    // stay on the page
    this.config.stay && this.stay();
    this.affix();
  };

  // node effects
  Pen.prototype._effectNode = function(el, returnAsNodeName) {
    var nodes = [];
    while(el !== this.config.editor && el!=null) {
      if(el.nodeName.match(/(?:[pubia]|h[1-6]|blockquote|[uo]l|li)/i)) {
        nodes.push(returnAsNodeName ? el.nodeName.toLowerCase() : el);
      }
      el = el.parentNode;
    }
    return nodes;
  };

  // remove style attr
  Pen.prototype.nostyle = function() {
    var els = this.config.editor.querySelectorAll('[style]');
    [].slice.call(els).forEach(function(item) {
      item.removeAttribute('style');
    });
    return this;
  };


  Pen.prototype.toolbar = function() {

    var that = this, icons = '';
    var menu = document.createElement('div');
    menu.setAttribute('class', this.config.className + '-menu pen-menu');

    var clickHandler = function(e) {
      var action = e.data.action;
      var eventData = e.data.eventData;
      if(!action) return;
      var apply = function(value) {
        that.config.editor.focus();
        if(typeof(that.bookmark) != 'undefined'){
          rangy.getSelection().moveToBookmark(that.bookmark);
        }
        that._actions(action, value);
        that.highlight();
      };

      // create link
      if(action === 'createlink') {
        var input = menu.getElementsByTagName('input')[0], createlink;

        input.style.display = 'block';
        input.focus();

        createlink = function(input) {
          input.style.display = 'none';
          if(input.value) return apply(input.value.replace(/(^\s+)|(\s+$)/g, '').replace(/^(?!http:\/\/|https:\/\/)(.*)$/, 'http://$1'));
          action = 'unlink';
          apply();
        };

        return input.onkeypress = function(e) {
          if(e.which === 13) return createlink(e.target);
        };
      }
      //e.preventDefault();
      //e.stopPropagation();
      apply(eventData);
    };


    for(var i = 0, list = this.config.list; i < list.length; i++) {
      
      var name = list[i];
      var HTML = (name.match(/^h[1-6]|p$/i) ? name.toUpperCase() : '');
      var icon = $('<div></div>').addClass('pen-icon '+name);
      if(HTML === '')
        icon.html(iconUnicode[name]);
      else
        icon.html(HTML);
      var data = {action: name,
                  eventData:'none'
          };

      icon.on('click', data, clickHandler);
      menu.appendChild(icon[0]);
      that._eventHandlers.push({elem: icon, event: 'click', handler:clickHandler});

      if(name === 'createlink'){
        var input = $('<input></input>').addClass('pen-input').attr('placeholder','http://');
        menu.appendChild(input[0]);
      }
    }

    if(this.config.events) {
      for(var i = 0, events = this.config.events; i < events.length; i++) {
        if(events[i].type === 'group'){
          var dropdownMenu =  $('<div class="pen-dropdown pen-icon"></div>').
                                html('<span class="dropdown-icon">'+events[i].content+'<i style="font-size:10px">&nbsp;\uf0d7</i></span>');
          var dropdownItems = $('<div class="pen-dropdown-items"></div>');
          //TODO add event handler for mouseout so that dropdown satys for some time after mouseout
          for(var j=0; j < events[i].options.length; j++){
            var option = events[i].options[j];
            var icon = $('<div></div>').addClass('pen-dropdown-option').html(option.content);
            var data = {action: 'event-'+ option.name,
                        eventData:option.data
                      };
            icon.on('click',data, clickHandler);
            dropdownItems.append(icon);
            that._eventHandlers.push({elem: icon, event: 'click', handler:clickHandler});
          }
          dropdownMenu.append(dropdownItems);
          $(menu).prepend(dropdownMenu);
        }
        else{
          var icon = $('<div></div>').addClass(events[i].className).html(events[i].content);
          var data = {action: 'event-'+ events[i].name,
                      eventData:'none'
                      };
          icon.on('click', data, clickHandler);
          $(menu).prepend(icon);
          that._eventHandlers.push({elem: icon, event: 'click', handler:clickHandler});
        }
      }
    }
    menu.style.display = 'block';
    var editor = this.config.editor;
    that._menu = menu;
    $(editor).parent().prepend($(menu));

    var bookmarkHandler = function(e){
      that.bookmark = rangy.getSelection().getBookmark(editor);
      that.highlight();
    };
    $(editor).bind('keyup', bookmarkHandler);
    $(editor).bind('mousedown', bookmarkHandler);
    $(editor).bind('mouseup', bookmarkHandler);
    that._eventHandlers.push({elem: $(editor), event: 'mouseup', handler:bookmarkHandler});
    that._eventHandlers.push({elem: $(editor), event: 'mousedown', handler:bookmarkHandler});
    that._eventHandlers.push({elem: $(editor), event: 'keyup', handler:bookmarkHandler});
    return this;
  };

  // highlight menu
  Pen.prototype.highlight = function() {

    var node = this._sel.focusNode
    //effectNode return an array of all the ancestor nodes till the root, which is the editor, of the selected node 
      , effects = this._effectNode(node)      
      , menu = this._menu
      , linkInput = menu.querySelector('input')
      , highlight;

    // remove all highlights
    [].slice.call(menu.querySelectorAll('.active')).forEach(function(el) {
      el.classList.remove('active');
    });

    // display link input if createlink enabled
    if (linkInput) linkInput.style.display = 'none';

    highlight = function(str) {
      var selector = '.' + str
      var el = menu.querySelector(selector);
      return el && el.classList.add('active');
    };
//we search for the tag in each of the ancestor node of the current selected node and appropriately highlight
    effects.forEach(function(item) {
      var tag = item.nodeName.toLowerCase();
      console.log(item);
      switch(tag) {
        case 'a': return (menu.querySelector('input').value = item.href), highlight('createlink');
        case 'i': return highlight('italic');
        case 'u': return highlight('underline');
        case 'b': return highlight('bold');
        case 'ul': return highlight('insertunorderedlist');
        case 'ol': return highlight('insertorderedlist');
        case 'ol': return highlight('insertorderedlist');
        case 'li': return highlight('indent');
        default : highlight(tag);
      }
    });

    return this;
  };

  Pen.prototype.actions = function() {
    var that = this, reg, block, overall, insert, callMyEvent;

    // allow command list
    reg = {
      event: /^(?:event-)/,
      block: /^(?:p|h[1-6]|blockquote|pre)$/,
      inline: /^(?:bold|italic|underline|insertorderedlist|insertunorderedlist|indent|outdent)$/,
      source: /^(?:insertimage|createlink|unlink)$/,
      insert: /^(?:inserthorizontalrule|insert)$/
    };

    overall = function(cmd, val) {
      var message = ' to exec 「' + cmd + '」 command' + (val ? (' with value: ' + val) : '');
      if(document.execCommand(cmd, false) && that.config.debug) {
        utils.log('success' + message);
      } else {
        utils.log('fail' + message);
      }
    };

    insert = function(name) {
      var range = that._sel.getRangeAt(0)
        , node = range.startContainer;

      while(node.nodeType !== 1) {
        node = node.parentNode;
      }

      range.selectNode(node);
      range.collapse(false);
      return overall(name);
    };

    block = function(name) {
      if(that._effectNode(that._sel.getRangeAt(0).startContainer, true).indexOf(name) !== -1) {
        if(name === 'blockquote') return document.execCommand('outdent', false, null);
        name = 'p';
      }
      return overall('formatblock', name);
    };

    callMyEvent = function(name, eventData) {
      var eventName = name.split('-')[1];
      $(that.config.editor).trigger({
        type: eventName,
        range: (that._sel.isCollapsed? null : that._sel.getRangeAt(0)),
        detail: eventData
      });
      //that.config.editor.dispatchEvent(event);
    };

    this._actions = function(name, value) {
      if(name.match(reg.event)) {
        callMyEvent(name, value);
      }
      else if(name.match(reg.block)) {
        block(name);
      } else if(name.match(reg.inline) || name.match(reg.source)) {
        overall(name, value);
      } else if(name.match(reg.insert)) {
        insert(name);
      } else {
        if(this.config.debug) utils.log('can not find command function for name: ' + name + (value ? (', value: ' + value) : ''));
      }
    };

    return this;
  };

  Pen.prototype.stay = function() {
    var that = this;
    !window.onbeforeunload && (window.onbeforeunload = function() {
      if(!that._isDestroyed) return 'Are you going to leave here?';
    });
  };

  Pen.prototype.affix = function(){
    var container = $(this.config.container);
    var editor = $(this.config.editor);
    var menu = $(this._menu);
    container.on('scroll', function(){
      if(editor.offset().top - container.offset().top > menu.height()){
        menu.css('top',0);
      }
      else if(editor.offset().top > container.offset().top){
          menu.css('top', menu.height() - (editor.offset().top - container.offset().top));
      }
      else if(container.offset().top - editor.offset().top < editor.height() - menu.height()){
        menu.css('top', menu.height() - (editor.offset().top - container.offset().top ) );
      }
      else {
        menu.css('top', editor.height() - menu.height());
      }
    });
  };

  Pen.prototype.destroy = function() {
    var destroy =  true, attr = 'removeAttribute';

    this._sel.removeAllRanges();
    this._menu.style.display = 'none';

    this._isDestroyed = destroy;
    this.config.editor[attr]('contenteditable', '');

    for (var z = 0; z < this._eventHandlers.length; z++) {
      console.log('destroying handlers on elem:');
      console.log(this._eventHandlers[z].elem);
      this._eventHandlers[z].elem.unbind(this._eventHandlers[z].event, this._eventHandlers[z].handler);
    }
    this._eventHandlers.length = 0;

    return this;
  };

  // a fallback for old browers
  FakePen = function(config) {
    if(!config) return utils.log('can\'t find config', true);

    var defaults = utils.merge(config)
      , klass = defaults.editor.getAttribute('class');

    klass = klass ? klass.replace(/\bpen\b/g, '') + ' pen-textarea ' + defaults.className : 'pen pen-textarea';
    defaults.editor.setAttribute('class', klass);
    defaults.editor.innerHTML = defaults.textarea;
    return defaults.editor;
  };

  // make it accessible
  window.Pen = document.getSelection ? Pen : FakePen;

    
});

