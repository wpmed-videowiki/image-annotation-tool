"use client";
import { Fragment, useId } from "react";
import {
  Box,
  Checkbox,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";

import { getIn } from "../../../utils/setIn";
import { useFieldError, useWizardDispatch, useWizardState } from "../WizardProvider";
import TemplatePreviewDialog from "../fields/TemplatePreviewDialog";
import BlockingWarning from "./BlockingWarning";
import InsetPanel from "./InsetPanel";

// Recursive renderer for the rights tree; the branching lives in rightsTree.js.
const RightsNode = ({ node, provider }) => {
  const t = useTranslations("UploadWizard");
  const state = useWizardState();
  const dispatch = useWizardDispatch();
  const labelId = useId();
  const error = useFieldError(node.path);

  // label keys live in either the rights or licenses namespace
  const label = (key) => (key ? t(`${node.namespace || "rights"}.${key}`) : "");
  const value = node.path ? getIn(state.metadata, node.path) : undefined;

  const heading = node.labelKey && !node.hideLabel && (
    <FormLabel
      component="legend"
      id={labelId}
      focused={false}
      sx={{ fontWeight: 600, color: "text.primary" }}
    >
      {node.numbered ? `${node.numbered}. ` : ""}
      {label(node.labelKey)}
    </FormLabel>
  );

  switch (node.type) {
    case "radio": {
      const selected = node.options.find((option) => option.value === value);

      // what a selected option reveals: warning + children, consecutive inset
      // children share one grey panel like on Commons
      const revealed = (option) => {
        const runs = [];
        for (const child of option.children || []) {
          const last = runs[runs.length - 1];
          if (child.inset && last?.inset) last.items.push(child);
          else runs.push({ inset: !!child.inset, items: [child] });
        }
        return (
          <>
            {option.warningKey && (
              <BlockingWarning id={`blocking-${option.value}`}>
                {label(option.warningKey)}
              </BlockingWarning>
            )}
            {runs.length > 0 && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                {runs.map((run, index) =>
                  run.inset ? (
                    <InsetPanel key={index} labelledBy={labelId}>
                      <Stack spacing={2}>
                        {run.items.map((child, childIndex) => (
                          <RightsNode
                            key={childIndex}
                            node={child}
                            provider={provider}
                          />
                        ))}
                      </Stack>
                    </InsetPanel>
                  ) : (
                    <Fragment key={index}>
                      {run.items.map((child, childIndex) => (
                        <RightsNode
                          key={childIndex}
                          node={child}
                          provider={provider}
                        />
                      ))}
                    </Fragment>
                  )
                )}
              </Stack>
            )}
          </>
        );
      };

      return (
        <FormControl component="fieldset" fullWidth error={!!error}>
          {heading}
          {node.hintKey && (
            <Typography variant="caption" color="text.secondary">
              {label(node.hintKey)}
            </Typography>
          )}
          <RadioGroup
            aria-labelledby={node.labelKey && !node.hideLabel ? labelId : undefined}
            value={value ?? ""}
            onChange={(event) =>
              dispatch({
                type: "SELECT_RIGHTS",
                path: node.path,
                value: event.target.value,
              })
            }
          >
            {node.options.map((option) => (
              <Fragment key={option.value}>
                <FormControlLabel
                  value={option.value}
                  control={<Radio size="small" sx={{ py: 0.25 }} />}
                  label={
                    <Stack>
                      <Typography variant="body2">{label(option.labelKey)}</Typography>
                      {option.hintKey && (
                        <Typography variant="caption" color="text.secondary">
                          {label(option.hintKey)}
                        </Typography>
                      )}
                    </Stack>
                  }
                  sx={{ alignItems: "flex-start", mt: 0.5 }}
                />
                {/* indent to the option label; unmountOnExit keeps hidden
                    inputs out of the tab order */}
                {!node.flatChildren && (
                  <Collapse in={value === option.value} unmountOnExit>
                    <Box sx={{ pl: { xs: 2, sm: 3.5 } }}>{revealed(option)}</Box>
                  </Collapse>
                )}
              </Fragment>
            ))}
          </RadioGroup>
          {/* Commons puts the top-level branch after the whole radio list */}
          {node.flatChildren && selected && (
            <Box>
              <Divider sx={{ my: 2 }} />
              {selected.introKey && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {label(selected.introKey)}
                </Typography>
              )}
              {revealed(selected)}
            </Box>
          )}
          {error && (
            <Typography variant="caption" color="error">
              {t(`errors.${error}`)}
            </Typography>
          )}
        </FormControl>
      );
    }

    case "checkboxGroup":
      return (
        <FormControl component="fieldset" error={!!error}>
          {heading}
          {node.hintKey && (
            <Typography variant="caption" color="text.secondary">
              {label(node.hintKey)}
            </Typography>
          )}
          <FormGroup>
            {node.options.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    size="small"
                    checked={(value || []).includes(option.value)}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_FIELD",
                        path: node.path,
                        value: event.target.checked
                          ? [...(value || []), option.value]
                          : (value || []).filter((entry) => entry !== option.value),
                      })
                    }
                  />
                }
                label={
                  <Typography variant="body2">{label(option.labelKey)}</Typography>
                }
              />
            ))}
          </FormGroup>
          {error && (
            <Typography variant="caption" color="error">
              {t(`errors.${error}`)}
            </Typography>
          )}
        </FormControl>
      );

    case "checkbox":
      return (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!value}
              onChange={(event) =>
                dispatch({
                  type: "SET_FIELD",
                  path: node.path,
                  value: event.target.checked,
                })
              }
            />
          }
          label={<Typography variant="body2">{label(node.labelKey)}</Typography>}
        />
      );

    case "text":
    case "textarea":
      return (
        <Stack spacing={0.5}>
          {heading}
          {node.hintKey && (
            <Typography variant="caption" color="text.secondary">
              {label(node.hintKey)}
            </Typography>
          )}
          <TextField
            size="small"
            fullWidth
            multiline={node.type === "textarea"}
            minRows={node.type === "textarea" ? 3 : undefined}
            value={value ?? ""}
            error={!!error}
            helperText={error ? t(`errors.${error}`) : undefined}
            onChange={(event) =>
              dispatch({
                type: "SET_FIELD",
                path: node.path,
                value: event.target.value,
              })
            }
          />
        </Stack>
      );

    case "textWithPreview":
      return (
        <Stack spacing={0.5}>
          {heading}
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              size="small"
              fullWidth
              value={value ?? ""}
              error={!!error}
              onChange={(event) =>
                dispatch({
                  type: "SET_FIELD",
                  path: node.path,
                  value: event.target.value,
                })
              }
            />
            <TemplatePreviewDialog text={value} provider={provider} />
          </Stack>
          <Typography variant="caption" color={error ? "error" : "text.secondary"}>
            {error ? t(`errors.${error}`) : label(node.hintKey)}
          </Typography>
        </Stack>
      );

    case "notice":
      return (
        <BlockingWarning severity={node.severity || "warning"}>
          {label(node.labelKey)}
        </BlockingWarning>
      );

    // author text field + "I don't know" checkbox that disables/clears it
    case "pairedUnknown": {
      const active = getIn(state.metadata, node.switchOn)
        ? node.when.true
        : node.when.false;
      return (
        <PairedUnknownField
          field={active}
          numbered={node.numbered}
          namespace={node.namespace}
        />
      );
    }

    default:
      return null;
  }
};

const PairedUnknownField = ({ field, numbered }) => {
  const t = useTranslations("UploadWizard");
  const state = useWizardState();
  const dispatch = useWizardDispatch();
  const error = useFieldError(field.path);
  const inputId = useId();

  const value = getIn(state.metadata, field.path);
  const unknown = !!getIn(state.metadata, field.unknownPath);

  return (
    <Stack spacing={0.5}>
      <FormLabel
        focused={false}
        sx={{ fontWeight: 600, color: "text.primary" }}
        htmlFor={inputId}
      >
        {numbered ? `${numbered}. ` : ""}
        {t(`rights.${field.labelKey}`)}
      </FormLabel>
      <TextField
        id={inputId}
        size="small"
        fullWidth
        value={value ?? ""}
        disabled={unknown}
        error={!!error}
        helperText={error ? t(`errors.${error}`) : undefined}
        onChange={(event) =>
          dispatch({ type: "SET_FIELD", path: field.path, value: event.target.value })
        }
      />
      {field.hintKey && (
        <Typography variant="caption" color="text.secondary">
          {t(`rights.${field.hintKey}`)}
        </Typography>
      )}
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={unknown}
            aria-controls={inputId}
            onChange={(event) => {
              dispatch({
                type: "SET_FIELD",
                path: field.unknownPath,
                value: event.target.checked,
              });
              // clear the paired input so stale values don't reach the wikitext
              if (event.target.checked) {
                dispatch({ type: "SET_FIELD", path: field.path, value: "" });
              }
            }}
          />
        }
        label={
          <Typography variant="body2">{t(`rights.${field.unknownLabelKey}`)}</Typography>
        }
      />
    </Stack>
  );
};

export default RightsNode;
