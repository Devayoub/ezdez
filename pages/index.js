import { useState, useEffect } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import * as helpers from "../utils/helpers";
import VideoFilePicker from "../components/VideoFilePicker";
import OutputVideo from "../components/OutputVideo";
import RangeInput from "../components/RangeInput";
let FF;
try {
  FF = createFFmpeg({
    // log: true,
    corePath: "https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js",
  });
} catch (error) {}

(async function () {
  await FF.load();
})();

function App() {
  const [inputVideoFile, setInputVideoFile] = useState(null);
  const [trimmedVideoFile, setTrimmedVideoFile] = useState(null);
  // const ref = useRef();
  const [videoMeta, setVideoMeta] = useState(null);
  const [URL, setURL] = useState([]);
  const [trimIsProcessing, setTrimIsProcessing] = useState(false);
  const [detectingSilent, setDetectingSilent] = useState(false);
  const [deletingSilent, setDeletingSilent] = useState(false);

  const [rStart, setRstart] = useState(0);
  const [parts, setParts] = useState([]);
  const [temStart, setTemStart] = useState();
  const [temEnd, setTemEnd] = useState();
  const [noise, setNoise] = useState(-30);
  const [padding, setPadding] = useState(0);

  const [duration, setDuration] = useState(3);

  const [rEnd, setRend] = useState(10);
  const [thumbNails, setThumbNails] = useState([]);
  const [thumbnailIsProcessing, setThumbnailIsProcessing] = useState(false);
  useEffect(() => {
    if (temStart && temEnd)
      setParts([...parts, { rStart: temStart, rEnd: temEnd, deleted: false }]);
  }, [temEnd]);

  const handleChange = async (e) => {
    let file = e.target.files[0];
    console.log(file);
    setInputVideoFile(file);

    setURL(await helpers.readFileAsBase64(file));
  };

  const handleLoadedData = async (e) => {
    // console.dir(ref.current);

    const el = e.target;

    const meta = {
      name: inputVideoFile.name,
      duration: el.duration,
      videoWidth: el.videoWidth,
      videoHeight: el.videoHeight,
    };
    console.log({ meta });
    setVideoMeta(meta);
    const thumbNails = await getThumbnails(meta);
    setThumbNails(thumbNails);
  };

  const getThumbnails = async ({ duration }) => {
    if (!FF.isLoaded()) await FF.load();
    setThumbnailIsProcessing(true);
    let MAX_NUMBER_OF_IMAGES = 15;
    let NUMBER_OF_IMAGES = duration < MAX_NUMBER_OF_IMAGES ? duration : 15;
    let offset =
      duration === MAX_NUMBER_OF_IMAGES ? 1 : duration / NUMBER_OF_IMAGES;

    const arrayOfImageURIs = [];
    FF.FS("writeFile", inputVideoFile.name, await fetchFile(inputVideoFile));
    try {
      FF.setProgress(({ ratio }) => {
        console.log(ratio * 100, "%");
        /*
         * ratio is a float number between 0 to 1.
         */
      });
    } catch (er) {
      console.log(err);
    }
    for (let i = 0; i < NUMBER_OF_IMAGES; i++) {
      let startTimeInSecs = helpers.toTimeString(Math.round(i * offset));

      try {
        await FF.run(
          "-ss",
          startTimeInSecs,
          "-i",
          inputVideoFile.name,
          "-t",
          "00:00:1.000",
          "-vf",
          `scale=150:-1`,
          `img${i}.png`
        );

        const data = FF.FS("readFile", `img${i}.png`);

        let blob = new Blob([data.buffer], { type: "image/png" });
        let dataURI = await helpers.readFileAsBase64(blob);
        FF.FS("unlink", `img${i}.png`);
        arrayOfImageURIs.push(dataURI);
      } catch (error) {
        console.log({ message: error });
      }
    }
    setThumbnailIsProcessing(false);

    return arrayOfImageURIs;
  };
  const detectSilent = async () => {
    FF.setLogger(({ type, message }) => {
      /*
       * type can be one of following:
       *
       * info: internal workflow debug messages
       * fferr: ffmpeg native stderr output
       * ffout: ffmpeg native stdout output
       */

      const start = message.includes("silence_start");
      const end = message.includes("silence_end");

      if (start) {
        console.log("start at:::", message.split(":")[1]);
        setTemStart(message.split(":")[1]);
      }
      if (end) {
        console.log("end at:::", message.split(":")[1].split("|")[0]);
        setTemEnd(message.split(":")[1].split("|")[0]);
        // const pE = ;
        // const newarra = [...parts.pop(), { rStart: pS, rEnd: pE }];
        // setParts([...newarra]);
      }
    });
    setDetectingSilent(true);
    try {
      await FF.run(
        "-i",
        inputVideoFile.name,
        "-af",
        `silencedetect=n=${noise}dB:d=${duration}`,
        "-f",
        `null`,
        "-"
      );
    } catch (error) {
      console.log(error);
    } finally {
      setDetectingSilent(false);
    }
  };

  const deleteSilent = async () => {
    setDeletingSilent(true);
    try {
      FF.FS("writeFile", inputVideoFile.name, await fetchFile(inputVideoFile));

      await FF.run(
        "-f",
        "concat",
        "-i",
        `
file ${inputVideoFile.name}
inpoint 90
outpoint 100
file ${inputVideoFile.name}
inpoint 200
outpoint 300
`,
        "-c",
        "copy",
        "ping.mp4"
      );

      const data = FF.FS("readFile", "ping.mp4");
      console.log(data);
      const dataURL = await helpers.readFileAsBase64(
        new Blob([data.buffer], { type: "video/mp4" })
      );

      setTrimmedVideoFile(dataURL);
    } catch (error) {
      console.log(error);
    } finally {
      setDeletingSilent(false);
    }
  };
  const handleTrim = async () => {
    setTrimIsProcessing(true);

    let startTime = ((rStart / 100) * videoMeta.duration).toFixed(2);
    let offset = ((rEnd / 100) * videoMeta.duration - startTime).toFixed(2);
    console.log(
      startTime,
      offset,
      helpers.toTimeString(startTime),
      helpers.toTimeString(offset)
    );

    try {
      FF.FS("writeFile", inputVideoFile.name, await fetchFile(inputVideoFile));
      // await FF.run('-ss', '00:00:13.000', '-i', inputVideoFile.name, '-t', '00:00:5.000', 'ping.mp4');
      // await FF.run(
      //   "-ss",
      //   helpers.toTimeString(startTime),
      //   "-i",
      //   inputVideoFile.name,
      //   "-t",
      //   helpers.toTimeString(offset),
      //   "-c",
      //   "copy",
      //   "ping.mp4"
      // );
      const alpha = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const stri = "";
      parts
        .filter((x) => x.deleted === true)
        .forEach((x, i) => {
          if (i === 0)
            stri =
              stri +
              `[0:v]trim=start=${x.rStart}:end=${x.rEnd},setpts=PTS-STARTPTS[${alpha[i]}];`;
          else if (i > 0 && i !== parts.length - 1) {
            if (i > 1) {
              stri =
                stri +
                `[0:v]trim=start=${x.rStart}:end=${
                  x.rEnd
                },setpts=PTS-STARTPTS[${alpha[i + 1]}];
        [${alpha[i]}][${alpha[i + 1]}]concat[${alpha[i + 2]}]`;
            }

            if (i > 2) {
              stri =
                stri +
                `[0:v]trim=start=${x.rStart}:end=${
                  x.rEnd
                },setpts=PTS-STARTPTS[${alpha[i + 2]}];\
        [${alpha[i + 1]}][${alpha[i + 2]}]concat[${alpha[i + 3]}]`;
            } else {
              stri =
                stri +
                `[0:v]trim=start=${x.rStart}:end=${
                  x.rEnd
                },setpts=PTS-STARTPTS[${alpha[i]}];
              [${alpha[i - 1]}][${alpha[i]}]concat[${alpha[i + 1]}]`;
            }
          } else if (i === parts.length - 1)
            stri =
              stri +
              `[0:v]trim=start=${x.rStart}:end=${x.rEnd},setpts=PTS-STARTPTS[${
                alpha[i]
              }];\
      [${alpha[i - 1]}][${alpha[i]}]concat[out1]\ `;
        });
      const ss = "-i";
      const pp = `[0:v]trim=start=25.442:end=29.8335,setpts=PTS-STARTPTS[a];[0:v]trim=start=35.0384:end= 39.5654,setpts=PTS-STARTPTS[b];[a][b]concat[c]`;

      const newstr = stri
        .replace(/\n|\r|(\n\r)/g, "")
        .trim()
        .replaceAll(" ", "");
      console.log("stri=i", newstr);
      await FF.run(
        ss,
        inputVideoFile.name,
        "-filter_complex",

        newstr,
        "-map",
        "[c]",
        "ping.mp4"
      );

      const data = FF.FS("readFile", "ping.mp4");
      console.log(data);
      const dataURL = await helpers.readFileAsBase64(
        new Blob([data.buffer], { type: "video/mp4" })
      );

      setTrimmedVideoFile(dataURL);
    } catch (error) {
      console.log(error);
    } finally {
      setTrimIsProcessing(false);
    }
  };

  const handleUpdateRange = (type) => {
    return (x, i) => {};
  };
  const handleDeletFrames = (e, i) => {
    const newarr = [...parts];
    newarr[i].deleted = e.target.checked;
    setParts([...newarr]);
  };

  return (
    <main className="App" style={{ backgroundColor: "black", color: "white" }}>
      {
        <>
          <RangeInput
            rEnd={rEnd}
            rStart={rStart}
            parts={parts}
            handleDeletFrames={handleDeletFrames}
            // handleUpdaterStart={handleUpdateRange("min")}
            // handleUpdaterEnd={handleUpdateRange("max")}
            loading={thumbnailIsProcessing}
            videoMeta={videoMeta}
            control={
              <div className="u-center">
                <button
                  onClick={handleTrim}
                  className="btn btn_b"
                  disabled={trimIsProcessing}
                >
                  {trimIsProcessing ? "trimming..." : "trim selected"}
                </button>
                <button
                  onClick={detectSilent}
                  className="btn btn_b"
                  disabled={detectingSilent}
                >
                  {detectingSilent ? "Detect Slilent..." : "Detected Slilent"}
                </button>
                <button
                  onClick={deleteSilent}
                  className="btn btn_b"
                  disabled={deletingSilent}
                >
                  {deletingSilent ? "DELETING" : "DELETED SILENT"}
                </button>
                <label>Noise</label>
                <input
                  id="number"
                  type="number"
                  value={noise}
                  onChange={(e) => {
                    setNoise(e.target.value);
                  }}
                  style={{ width: 100, height: 40 }}
                />
                <label>DURATION</label>
                <input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => {
                    setDuration(e.target.value);
                  }}
                  style={{ width: 100, height: 40 }}
                />
                <label>PADDING</label>
                <input
                  id="duration"
                  type="number"
                  value={padding}
                  onChange={(e) => {
                    setPadding(e.target.value);
                  }}
                  style={{ width: 100, height: 40 }}
                />
              </div>
            }
            thumbNails={thumbNails}
          />
        </>
      }
      <section className="deck">
        <article className="grid_txt_2">
          <VideoFilePicker
            handleChange={handleChange}
            showVideo={!!inputVideoFile}
          >
            <div className="bord_g_2 p_2">
              <video
                src={inputVideoFile ? URL : null}
                autoPlay
                controls
                muted
                onLoadedMetadata={handleLoadedData}
                width="450"
              ></video>
            </div>
          </VideoFilePicker>
        </article>
        <OutputVideo
          videoSrc={trimmedVideoFile}
          handleDownload={() => helpers.download(trimmedVideoFile)}
        />
      </section>
    </main>
  );
}

export default App;

export async function getServerSideProps(context) {
  // set HTTP header

  context.res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  context.res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  console.log({ isSecureContext: context });
  return {
    props: {},
  };
}
