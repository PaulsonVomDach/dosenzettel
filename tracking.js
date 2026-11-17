/* Dosenzettel: anonyme Zählung mit Umami (cloud.umami.is, Datenregion EU)
 *
 * Diese Datei ist alles, was gemessen wird. Sie zählt nur, WELCHE Funktion
 * benutzt wird, z. B. "Liste kopiert" oder "Warenkorb-Skript für Marke X".
 *
 * Nicht gemessen wird:
 * - keine Bilder, keine Farbwerte aus Bildern, keine Listen, keine Kombis
 * - keine Cookies, kein Login, keine Wiedererkennung über Tage hinweg
 *
 * Gezählt wird nur auf dosenzettel.pages.dev (nicht lokal, nicht in Vorschauen).
 * Mit "Do Not Track" im Browser wird gar nichts gezählt.
 * Selbst abschalten: in der Browser-Konsole localStorage.setItem("umami.disabled", 1)
 */
(function () {
  "use strict";

  function track(name, data) {
    try {
      if (window.umami && typeof window.umami.track === "function") window.umami.track(name, data);
    } catch (e) { /* Zählung darf die Seite nie stören */ }
  }

  function pressed(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.getAttribute("aria-pressed") === "true") return id;
    }
    return null;
  }

  function currentMode() {
    const m = pressed(["modeSketch", "modePhoto", "modeCombo"]);
    return m === "modePhoto" ? "foto" : m === "modeCombo" ? "kombi" : "skizze";
  }

  function brandOf(btn) {
    const h = btn.closest(".cangroup") && btn.closest(".cangroup").querySelector("h3");
    return h && h.firstChild ? String(h.firstChild.textContent).trim() : "unbekannt";
  }

  const MODES = { modeSketch: "skizze", modePhoto: "foto", modeCombo: "kombi" };

  /* Klicks */
  document.addEventListener("click", function (e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    let el;

    if ((el = t.closest("#modeSketch, #modePhoto, #modeCombo"))) return track("modus-gewechselt", { modus: MODES[el.id] });
    if (t.closest("#demoBtn")) return track("beispiel-geladen");
    if ((el = t.closest("#mOne, #mMix"))) return track("markenwahl", { art: el.id === "mMix" ? "markenmix" : "eine-marke" });

    if (t.closest("#copyBtn")) return track("liste-kopiert", { modus: currentMode() });
    if (t.closest("#addBasket")) return track("sammelkorb-hinzugefuegt");
    if (t.closest("#basketCopy")) return track("sammelkorb-kopiert");
    if (t.closest("#comboSave")) return track("kombi-gespeichert");

    if ((el = t.closest("[data-cart]"))) return track("warenkorb-skript", { marke: brandOf(el), shop: "betterrun.shop", quelle: "einkaufsliste" });
    if ((el = t.closest("[data-bcart]"))) return track("warenkorb-skript", { marke: brandOf(el), shop: "betterrun.shop", quelle: "sammelkorb" });

    if ((el = t.closest("[data-shop]"))) return track("shop-geoeffnet", { marke: brandOf(el), quelle: el.closest("#cans") ? "einkaufsliste" : "sammelkorb" });

    if (t.closest("#finderOut [data-swap]")) return track("ersatz-getauscht");
    if (t.closest("#finderOut [data-addx]")) return track("extra-dose-hinzugefuegt");
    if (t.closest("#cans .can")) return track("ersatz-angesehen");

    if (t.closest("#instaBtn")) return track("feedback-geklickt", { weg: "instagram" });
    if (t.closest("#feedbackBtn")) return track("feedback-geklickt", { weg: "mail" });
  });

  /* Marke gewählt (nur der Markenname) */
  document.addEventListener("change", function (e) {
    const t = e.target;
    if (t && t.id === "brandSel" && t.value) track("marke-gewaehlt", { marke: t.value });
  });

  /* Bild geladen: nur DASS ein Bild geladen wurde, nicht welches.
     Capture-Phase, weil die Seite das Dateifeld danach sofort leert. */
  document.addEventListener("change", function (e) {
    const t = e.target;
    if (t && t.id === "file" && t.files && t.files[0] && /^image\//.test(t.files[0].type)) {
      track("bild-geladen", { modus: currentMode(), weg: "auswahl" });
    }
  }, true);

  document.addEventListener("drop", function (e) {
    const t = e.target;
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (t instanceof Element && t.closest("#drop") && f && /^image\//.test(f.type)) {
      track("bild-geladen", { modus: currentMode(), weg: "reinziehen" });
    }
  }, true);
})();
