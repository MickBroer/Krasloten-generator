/* BESTANDEN — afbeeldingen lezen en project-/downloadbestanden behandelen. */
(function (root) {
  'use strict';
  const images = new Map();

  async function loadImage(source) {
    if (images.has(source)) return images.get(source);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(Error('This image could not be read.'));
      element.src = source;
    });
    images.set(source, image);
    return image;
  }

  function getImage(source) {
    return images.get(source);
  }

  async function readImage(file) {
    if (!file || file.size > 25 * 1024 * 1024 ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw Error('Choose a PNG, JPEG or WebP image smaller than 25 MB.');
    }
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(Error('The file could not be read.'));
      reader.readAsDataURL(file);
    });
    await loadImage(source);
    return source;
  }

  async function loadProjectImages(project) {
    const sources = new Set([
      project.front, project.back, ...project.icons, ...(project.result?.icons || []),
      ...project.nudes.map((image) => image.src),
      ...(project.result?.nudes || []).map((image) => image.src)
    ]);
    for (const ticket of project.result?.tickets || []) {
      for (const overlay of ticket.edits?.overlays || []) {
        if (overlay.type === 'image') sources.add(overlay.src);
      }
    }
    // Na openen is alles geladen; preview en export gebruiken dezelfde afbeeldingen.
    for (const source of sources) {
      if (source) await loadImage(source);
    }
    for (const source of images.keys()) {
      if (!sources.has(source)) images.delete(source);
    }
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function readProject(file) {
    if (!file || file.size > 100 * 1024 * 1024) {
      throw Error('Choose a project smaller than 100 MB.');
    }
    return JSON.parse(await file.text());
  }

  root.StudioFiles = { loadImage, getImage, readImage, loadProjectImages, download, readProject };
})(globalThis);
