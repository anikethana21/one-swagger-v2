import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ApiResponseDef } from '../types';
import type { RefResolver } from '../lib/spec/normalize';
import { exampleFromMedia, isJsonMediaType, preferredMediaType } from '../lib/spec/schema';
import { JsonView } from './JsonView';

function statusClass(status: string): string {
  const code = parseInt(status, 10);
  if (Number.isNaN(code)) return 'status-default';
  if (code >= 200 && code < 300) return 'status-2xx';
  if (code >= 300 && code < 400) return 'status-3xx';
  if (code >= 400 && code < 500) return 'status-4xx';
  return 'status-5xx';
}

interface ResponsesDocProps {
  responses: ApiResponseDef[];
  resolver: RefResolver;
}

export const ResponsesDoc: React.FC<ResponsesDocProps> = ({ responses, resolver }) => {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (responses.length === 0) return null;

  return (
    <div className="responses-doc">
      <div className="section-head">
        <div className="section-head-title">
          <h3>Responses</h3>
        </div>
      </div>
      <div className="responses-list">
        {responses.map((response) => {
          const isOpen = Boolean(open[response.status]);
          const contentTypes = Object.keys(response.content || {});
          const mediaType = contentTypes.length ? preferredMediaType(response.content) : '';
          const media = mediaType ? response.content?.[mediaType] : undefined;
          const example = media ? exampleFromMedia(media, resolver, { mode: 'response' }) : undefined;
          const hasDetails = Boolean(media || response.headers);
          return (
            <div className={`response-doc ${isOpen ? 'is-open' : ''}`} key={response.status}>
              <button
                type="button"
                className="response-doc-row"
                onClick={() => setOpen((previous) => ({ ...previous, [response.status]: !previous[response.status] }))}
                aria-expanded={isOpen}
                data-testid={`response-doc-${response.status}`}
              >
                <span className={`doc-status ${statusClass(response.status)}`}>{response.status}</span>
                <span className="response-doc-description">{response.description || 'No description'}</span>
                <span className="response-doc-type mono">{mediaType || ''}</span>
                {hasDetails ? (
                  <span className="response-doc-chevron">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                ) : (
                  <span className="response-doc-chevron" />
                )}
              </button>
              {isOpen && hasDetails ? (
                <div className="response-doc-body">
                  {media ? (
                    <div className="response-doc-example">
                      <div className="mini-label">
                        Example
                        <span className="mono">{mediaType}</span>
                      </div>
                      <JsonView
                        value={example}
                        rawText={
                          isJsonMediaType(mediaType)
                            ? undefined
                            : typeof example === 'string'
                              ? example
                              : JSON.stringify(example, null, 2)
                        }
                      />
                    </div>
                  ) : null}
                  {response.headers ? (
                    <div className="response-doc-headers">
                      <div className="mini-label">Response headers</div>
                      <table className="table">
                        <tbody>
                          {Object.entries(response.headers).map(([name, header]) => (
                            <tr key={name}>
                              <td className="header-key">{name}</td>
                              <td className="header-value">
                                {header.description || header.schema?.type || 'string'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
