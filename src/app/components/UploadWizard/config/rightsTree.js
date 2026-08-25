// The rights step as a data tree. RightsNode.js renders it, and validation and the
// reducer's cascade-clear walk the same tree, so UI and validation can't drift.
//
// Node types: radio, checkboxGroup, text, textarea, textWithPreview,
// pairedUnknown (text + "I don't know" checkbox), notice.
//
// `labelKey` resolves against the UploadWizard.rights i18n namespace, `upstream` is
// the matching UploadWizard message key on Commons.

import {
  CREATOR_LICENSES,
  HEIR_LICENSES,
  OWN_WORK_LICENSES,
  PERMISSION_LICENSES,
  PUBLIC_DOMAIN_REASONS,
} from "../../../config/commonsLicenses.js";

// every path a node can write (used to clear abandoned subtrees)
const ownPath = (field) => `rights.own.${field}`;
const tpPath = (field) => `rights.thirdParty.${field}`;

const licenseNode = ({ path, options, labelKey, customPath, numbered, inset }) => ({
  type: "radio",
  path,
  labelKey,
  namespace: "licenses",
  numbered,
  inset,
  required: true,
  options: options.map((option) => ({
    value: option.value,
    labelKey: option.labelKey,
    hintKey: option.hintKey,
    blocking: !!option.blocking,
    warningKey: option.blocking ? "license_unknown_warning" : undefined,
    children: option.custom
      ? [
          {
            type: "textWithPreview",
            path: customPath,
            hintKey: "custom_hint",
            namespace: "licenses",
            required: true,
          },
        ]
      : undefined,
  })),
});

export const RIGHTS_TREE = {
  type: "radio",
  path: "rights.ownership",
  labelKey: "ownership_label",
  required: true,
  hideLabel: true,
  // Commons shows the selected branch below the whole radio list, not nested
  flatChildren: true,
  options: [
    {
      value: "own",
      labelKey: "ownership_own",
      upstream: "mwe-upwiz-source-ownwork",
      children: [
        {
          type: "radio",
          path: ownPath("originality"),
          labelKey: "own_origin_label",
          numbered: 1,
          required: true,
          options: [
            {
              value: "entirely-mine",
              labelKey: "own_origin_own",
              upstream: "mwe-upwiz-source-ownwork-origin-option-own",
            },
            {
              value: "contains-others",
              labelKey: "own_origin_others",
              upstream: "mwe-upwiz-source-ownwork-origin-option-others",
              children: [
                {
                  type: "radio",
                  path: ownPath("othersWork"),
                  labelKey: "own_others_label",
                  inset: true,
                  required: true,
                  options: [
                    {
                      value: "free-license",
                      labelKey: "own_others_freelicense",
                      upstream: "mwe-upwiz-source-ownwork-origin-option-others-freelicense",
                    },
                    {
                      value: "not-protected",
                      labelKey: "own_others_nocopyright",
                      upstream: "mwe-upwiz-source-ownwork-origin-option-others-nocopyright",
                    },
                    {
                      value: "copyright-protected",
                      labelKey: "own_others_copyrighted",
                      blocking: true,
                      warningKey: "own_others_copyrighted_warning",
                    },
                    {
                      value: "unknown",
                      labelKey: "own_others_unknown",
                      blocking: true,
                      warningKey: "own_others_unknown_warning",
                    },
                  ],
                },
              ],
            },
            {
              value: "ai-generated",
              labelKey: "own_origin_ai",
              upstream: "mwe-upwiz-source-ownwork-origin-option-ai",
              children: [
                {
                  type: "text",
                  path: ownPath("aiEngine"),
                  labelKey: "ai_engine_label",
                  hintKey: "ai_engine_hint",
                  inset: true,
                  required: true,
                },
                {
                  type: "textarea",
                  path: ownPath("aiPrompt"),
                  labelKey: "ai_prompt_label",
                  upstream: "mwe-upwiz-source-ownwork-origin-option-ai-prompt",
                  inset: true,
                },
              ],
            },
          ],
        },
        licenseNode({
          path: ownPath("license"),
          options: OWN_WORK_LICENSES,
          labelKey: "own_license_label",
          customPath: ownPath("customLicense"),
          numbered: 2,
        }),
      ],
    },
    {
      value: "third-party",
      labelKey: "ownership_thirdparty",
      upstream: "mwe-upwiz-source-thirdparty",
      introKey: "tp_intro",
      children: [
        {
          type: "radio",
          path: tpPath("reason"),
          labelKey: "tp_reason_label",
          numbered: 1,
          required: true,
          options: [
            {
              value: "creator-free-license",
              labelKey: "tp_reason_freelicense",
              children: [
                licenseNode({
                  path: tpPath("creatorLicense"),
                  options: CREATOR_LICENSES,
                  labelKey: "tp_creator_license_label",
                  customPath: tpPath("customLicense"),
                  inset: true,
                }),
              ],
            },
            {
              value: "heir",
              labelKey: "tp_reason_heir",
              children: [
                licenseNode({
                  path: tpPath("heirLicense"),
                  options: HEIR_LICENSES,
                  labelKey: "tp_heir_license_label",
                  inset: true,
                }),
              ],
            },
            {
              value: "not-protected",
              labelKey: "tp_reason_nocopyright",
              hintKey: "tp_reason_nocopyright_hint",
              children: [
                {
                  type: "checkboxGroup",
                  path: tpPath("publicDomain"),
                  labelKey: "tp_pd_label",
                  hintKey: "tp_pd_hint",
                  namespace: "licenses",
                  inset: true,
                  required: true,
                  options: PUBLIC_DOMAIN_REASONS.map((reason) => ({
                    value: reason.value,
                    labelKey: reason.labelKey,
                  })),
                },
                {
                  type: "textWithPreview",
                  path: tpPath("customPd"),
                  labelKey: "pd_tag_label",
                  hintKey: "pd_tag_hint",
                  namespace: "licenses",
                  inset: true,
                },
              ],
            },
            {
              value: "permission",
              labelKey: "tp_reason_permission",
              upstream: "mwe-upwiz-source-permission",
              children: [
                {
                  type: "notice",
                  severity: "warning",
                  labelKey: "tp_permission_warning",
                  upstream: "mwe-upwiz-license-vrt-head-extra",
                },
                licenseNode({
                  path: tpPath("permissionLicense"),
                  options: PERMISSION_LICENSES,
                  labelKey: "tp_permission_license_label",
                  customPath: tpPath("customLicense"),
                  inset: true,
                }),
              ],
            },
            {
              value: "unknown",
              labelKey: "tp_reason_unknown",
              blocking: true,
              warningKey: "tp_reason_unknown_warning",
            },
          ],
        },
        // shown for all third-party work
        {
          type: "text",
          path: tpPath("source"),
          labelKey: "source_label",
          numbered: 2,
          upstream: "mwe-upwiz-source-text",
          required: true,
        },
        {
          type: "checkbox",
          path: tpPath("aiGenerated"),
          labelKey: "is_ai_label",
        },
        {
          type: "pairedUnknown",
          numbered: 3,
          // which pair shows depends on the AI checkbox
          switchOn: tpPath("aiGenerated"),
          when: {
            false: {
              path: tpPath("author"),
              unknownPath: tpPath("authorUnknown"),
              labelKey: "author_label",
              unknownLabelKey: "author_unknown_label",
            },
            true: {
              path: tpPath("aiAuthor"),
              unknownPath: tpPath("aiAuthorUnknown"),
              labelKey: "ai_info_label",
              hintKey: "ai_info_hint",
              unknownLabelKey: "ai_info_unknown_label",
              upstream: "mwe-upwiz-author-text-ai",
            },
          },
        },
      ],
    },
  ],
};

// walk the nodes currently visible, following selected options
export const collectVisibleNodes = (state, node = RIGHTS_TREE, out = []) => {
  out.push(node);

  if (node.type === "radio") {
    const selected = getPath(state, node.path);
    const option = node.options.find((o) => o.value === selected);
    for (const child of option?.children || []) collectVisibleNodes(state, child, out);
  }

  if (node.type === "pairedUnknown") {
    // only the active half of the pair is visible
    const active = getPath(state, node.switchOn) ? node.when.true : node.when.false;
    out.push({ ...active, type: "pairedUnknownField" });
  }

  for (const child of node.children || []) collectVisibleNodes(state, child, out);
  return out;
};

export const getPath = (object, path) =>
  path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), object);

// all paths below a node, so switching a radio resets the abandoned branch
// (otherwise a stale answer could keep blocking the upload)
export const descendantPaths = (node, out = []) => {
  for (const option of node.options || []) {
    for (const child of option.children || []) {
      if (child.path) out.push(child.path);
      descendantPaths(child, out);
    }
  }
  for (const child of node.children || []) {
    if (child.path) out.push(child.path);
    descendantPaths(child, out);
  }
  if (node.type === "pairedUnknown") {
    out.push(
      node.when.true.path,
      node.when.true.unknownPath,
      node.when.false.path,
      node.when.false.unknownPath
    );
  }
  return out;
};
