import mongoose from "mongoose";

import {
  CREATOR_LICENSE_VALUES,
  HEIR_LICENSE_VALUES,
  OTHERS_WORK_VALUES,
  OWNERSHIP_VALUES,
  OWN_ORIGINALITY_VALUES,
  OWN_WORK_LICENSE_VALUES,
  PERMISSION_LICENSE_VALUES,
  PUBLIC_DOMAIN_VALUES,
  THIRD_PARTY_REASON_VALUES,
} from "../config/commonsLicenses.js";

const Schema = mongoose.Schema;

// Casting and enum checks only, the real validation is normalizeUploadMetadata.
// Nothing is `required` since only one rights branch is ever populated.
// _id: false everywhere or Mongo adds ObjectIds to every nested object.
const options = { _id: false };

// "" allowed so unreached branches can stay empty
const optionalEnum = (values) => ({
  type: String,
  enum: [...values, ""],
  default: "",
});

const LocalizedTextSchema = new Schema(
  {
    lang: { type: String, default: "en" },
    text: { type: String, default: "" },
  },
  options
);

const DepictsSchema = new Schema(
  {
    id: { type: String, default: "" },
    // cached from Wikidata for display; only `id` reaches Commons
    label: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  options
);

const LocationSchema = new Schema(
  {
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
    heading: { type: Number, default: null },
  },
  options
);

const OwnRightsSchema = new Schema(
  {
    originality: optionalEnum(OWN_ORIGINALITY_VALUES),
    othersWork: optionalEnum(OTHERS_WORK_VALUES),
    aiEngine: { type: String, default: "" },
    aiPrompt: { type: String, default: "" },
    license: optionalEnum(OWN_WORK_LICENSE_VALUES),
    customLicense: { type: String, default: "" },
  },
  options
);

const ThirdPartyRightsSchema = new Schema(
  {
    reason: optionalEnum(THIRD_PARTY_REASON_VALUES),
    creatorLicense: optionalEnum(CREATOR_LICENSE_VALUES),
    heirLicense: optionalEnum(HEIR_LICENSE_VALUES),
    publicDomain: { type: [String], enum: PUBLIC_DOMAIN_VALUES, default: [] },
    customPd: { type: String, default: "" },
    permissionLicense: optionalEnum(PERMISSION_LICENSE_VALUES),
    customLicense: { type: String, default: "" },
    source: { type: String, default: "" },
    aiGenerated: { type: Boolean, default: false },
    author: { type: String, default: "" },
    authorUnknown: { type: Boolean, default: false },
    aiAuthor: { type: String, default: "" },
    aiAuthorUnknown: { type: Boolean, default: false },
  },
  options
);

const RightsSchema = new Schema(
  {
    ownership: optionalEnum(OWNERSHIP_VALUES),
    own: { type: OwnRightsSchema, default: () => ({}) },
    thirdParty: { type: ThirdPartyRightsSchema, default: () => ({}) },
  },
  options
);

const DescribeSchema = new Schema(
  {
    title: { type: String, default: "" },
    captions: { type: [LocalizedTextSchema], default: [] },
    sameAsCaption: { type: Boolean, default: true },
    descriptions: { type: [LocalizedTextSchema], default: [] },
    date: { type: String, default: "" },
    depicts: { type: [DepictsSchema], default: [] },
    categories: { type: [String], default: [] },
    location: { type: LocationSchema, default: () => ({}) },
    otherInformation: { type: String, default: "" },
  },
  options
);

const UploadMetadataSchema = new Schema(
  {
    // the worker checks this, so a future v2 shape gets skipped not crashed on
    version: { type: Number, default: 1 },
    rights: { type: RightsSchema, default: () => ({}) },
    describe: { type: DescribeSchema, default: () => ({}) },
  },
  options
);

export default UploadMetadataSchema;
