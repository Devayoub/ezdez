import React from "react";
import * as helpers from "../utils/helpers";

export default function RangeInput({
  thumbNails,
  rEnd,
  rStart,
  parts,
  handleDeletFrames,
  handleUpdaterStart,
  handleUpdaterEnd,
  loading,
  control,
  videoMeta,
}) {
  let RANGE_MAX = 100;

  if (thumbNails.length === 0 && !loading) {
    return null;
  }

  if (loading) {
    return (
      <center>
        <h2> processing thumbnails.....</h2>
      </center>
    );
  }

  return (
    <>
      <div className="range_pack">
        <div className="image_box">
          {thumbNails.map((imgURL, id) => (
            <img src={imgURL} alt={`sample_video_thumbnail_${id}`} key={id} />
          ))}
          {parts.map((x, i) => {
            return (
              <>
                <div
                  className="clip_box"
                  style={{
                    width: `calc(${x.rEnd - x.rStart}% )`,
                    left: `${x.rStart}%`,
                  }}
                  data-start={helpers.toTimeString(x.rStart, false)}
                  data-end={helpers.toTimeString(x.rEnd, false)}
                >
                  <span className="clip_box_des"></span>
                  <label>
                    <input
                      type="checkbox"
                      checked={x.deleted}
                      onChange={(e) => {
                        handleDeletFrames(e, i);
                      }}
                    />
                    Delete
                  </label>

                  <span className="clip_box_des"></span>
                </div>

                <input
                  className="range"
                  type="range"
                  min={0}
                  max={RANGE_MAX}
                  // onInput={(e) => handleUpdaterStart(e.target.value, i)}
                  value={x.rStart}
                />

                <input
                  className="range"
                  type="range"
                  min={0}
                  max={RANGE_MAX}
                  // onInput={(e) => handleUpdaterEnd(e.target.value, i)}
                  value={x.rEnd}
                />
              </>
            );
          })}
        </div>
      </div>

      {control}
    </>
  );
}
