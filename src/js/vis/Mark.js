vde.Vis.Mark = (function() {
  var mark = function(name) {
    this.name = name;
    this.displayName = name;

    this.group    = null;
    this.pipeline = null;
    this.encoders = []; // Visual encoders

    this._spec = {
      properties: {
        enter:  {},
        update: {},
        hover:  {}
      }
    };

    return this;
  };

  var prototype = mark.prototype;

  prototype.init = function() {
    if(!this.group)
      this.group = new vde.Vis.marks.Group();

    if(!this.name)
      this.name = this.type + '_' + (vg.keys(this.group.marks).length+1);

    if(!this.displayName) 
      this.displayName = this.name;

    this.group.marks[this.name] = this;

    return this;
  };

  prototype.spec = function() {
    var spec = vg.duplicate(this._spec);

    vde.Vis.Callback.run('mark.pre_spec', this, {spec: spec});

    spec.name = this.name;
    spec.type = this.type;
    spec.from = {};

    if(this.pipeline) spec.from.data = this.pipeline.name;

    // Visual encoders
    if(this.encoders) {
      spec.from.transform = [];
      this.encoders.forEach(function(e) {
        spec.from.transform.push(e.spec());
      })
    }

    var props = {};

    for(var prop in this.properties) {
      var p = this.properties[prop];
      props[prop] = {};

      vg.keys(p).forEach(function(k) {
        if(p[k] == undefined) return;

        if(k == 'scale') props[prop][k] = p[k].name;
        else if(k == 'field') props[prop][k] = p[k].spec();
        else props[prop][k] = p[k];
      });
    }

    spec.properties.enter  = props;
    // spec.properties.update = props;

    vde.Vis.Callback.run('mark.post_spec', this, {spec: spec});

    return spec;
  };

  prototype.enter = function(k, v) {
    return this.prop('enter', k, v);
  };

  prototype.update = function(k, v) {
    if(!k && !v) return this.updateProps();

    return this.prop('update', k, v);
  };

  prototype.hover = function(k, v) {
    return this.prop('hover', k, v);
  };

  prototype.prop = function(type, k, v) {
    if(!v) return this._spec.properties[type][k];

    this._spec.properties[type][k] = v;
    return this;
  };

  prototype.unbindProperty = function(prop) {
    this.properties[prop] = {value: 0};
  };

  prototype.def = function() {
    var path = [], p = this,
    defs = vde.Vis.view.model().defs(),
    d = defs.marks;

    while(p) {
      path.push(p.name);
      p = p.group;
    }

    var findMarkDef = function(def, name) {
      if(def.name == name)
        return def;

      for(var i = 0; i < def.marks.length; i++) {
        if(def.marks[i].name == name)
          return def.marks[i];
      }

      return null;
    } 

    while(p = path.pop()) {
      if(d.name == p)
        continue;

      d = findMarkDef(d, p);
      if(!d)
        return null;
    }

    return d;
  };

  prototype.updateProps = function() {
    var def  = this.def(),
        spec = this.spec();

    def.properties.enter  = vg.parse.properties(spec.properties.enter);
    def.properties.update = vg.parse.properties(spec.properties.update);
  };

  return mark;
})();

vde.Vis.marks = {};