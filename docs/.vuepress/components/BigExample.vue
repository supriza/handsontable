<template>
  <div class="bigPreviewExample">
    <div class="row tab">
      <div class="text-left">
        <ul>
          <li id="tab-preview" class="active">
            Preview
          </li>
        </ul>
      </div>

      <div class="text-right">
        <ul>
          <li class="frameworks-label">
            Source code:
          </li>
          <slot></slot>
        </ul>
      </div>
    </div>

    <div id="tab-content-preview" class="active">
      <iframe
        :src="previewUrl"
        class="bigPreviewExampleIframe"
        allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone;
          midi; payment; usb; vr; xr-spatial-tracking"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
      ></iframe>
    </div>

    <div hidden>
      <SvgFrameworkIcons></SvgFrameworkIcons>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BigExample',
  props: ['preview'],
  computed: {
    previewUrl() {
      if (!this.preview.startsWith('/')) {
        throw new Error('The preview property of BigExample should begin with /');
      }

      return `https://handsontable.github.io/handsontable${this.preview}`;
    }
  }
};
</script>
