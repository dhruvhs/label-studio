import { CONTROLS, OBJECTS } from "./tags";
import { Palette } from "../../../utils/colors";

export const EMPTY_CONFIG = "<View></View>";
export const DEFAULT_COLUMN = "$undefined$";
export const isEmptyConfig = (config) =>
  ["", EMPTY_CONFIG].includes(config.replace(/\s+/g, ""));

export class Template {
  objects = [];
  controls = [];
  details = false;
  palette = Palette();

  constructor(tpl) {
    this.tpl = tpl;
    this.config = tpl.config;

    const parser = new DOMParser();

    this.$root = parser.parseFromString(this.config, "application/xml");

    const root = this.$root?.children?.[0];
    let parserError;

    if (root?.tagName === "parsererror") parserError = root;
    else if (root?.children?.[0]?.tagName === "parsererror")
      parserError = root.children[0];

    if (parserError) {
      throw new Error(parserError.innerText);
    }

    this.serializer = new XMLSerializer();

    this.initRoot();
  }

  flatten(el) {
    const tags = [];

    for (let tag of el.children) {
      tags.push(tag);
      if (tag.children.length) tags.push(...this.flatten(tag));
    }
    return tags;
  }

  onConfigUpdate() {
    // should be overwritten
  }

  render() {
    const config = this.serializer.serializeToString(this.$root);

    this.config = config;
    this.onConfigUpdate(config);
  }

  initRoot() {
    const tags = this.flatten(this.$root);

    this.objects = tags.filter(
      ($tag) => $tag.tagName in OBJECTS && $tag.getAttribute("value")
    );
    const names = this.objects.map(($tag) => $tag.getAttribute("name"));

    this.controls = tags.filter(($tag) =>
      names.includes($tag.getAttribute("toName"))
    );

    for (let $object of this.objects) {
      const object = OBJECTS[$object.tagName];

      $object.$controls = this.controls.filter(
        ($tag) => $tag.getAttribute("toName") === $object.getAttribute("name")
      );
      $object.$controls.forEach(($control) => ($control.$object = $object));

      for (let item in object.settings) {
        object.settings[item].object = $object;
      }

      let settings = { ...object.settings };

      $object.$controls.forEach(($control) => {
        let control = CONTROLS[$control.tagName];

        if (control) {
          for (let item in control.settings) {
            control.settings[item].control = $control;
            control.settings[item].object = $object;
          }

          settings = { ...settings, ...control.settings };
        }
      });
      this.settings = settings;
    }
  }

  addLabels(control, labels) {
    if (!labels) return;
    if (!Array.isArray(labels)) {
      labels = labels
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (!labels.length) return;

    const existing = [...control.children].map((ch) =>
      ch.getAttribute("value")
    );
    const isChoices = control.tagName === "Choices";

    labels.forEach((label) => {
      if (existing.includes(label)) return;
      existing.push(label);
      const $label = this.$root.createElement(isChoices ? "Choice" : "Label");

      $label.setAttribute("value", label);
      if (!isChoices)
        $label.setAttribute("background", this.palette.next().value);
      control.appendChild($label);
    });

    this.render();
  }

  removeLabel($label) {
    $label.parentNode.removeChild($label);
    this.render();
  }

  changeLabel($label, attrs) {
    for (let attr of Object.keys(attrs)) {
      $label.setAttribute(attr, attrs[attr]);
    }
    this.render();
  }
}
