export default function VideoPlayer() {
  return (
    <div className="video-player">
      <video
        className="video-element"
        src="/videos/sample-video.mp4"
        //영상 경로 /public/videos 하위애 위치
        autoPlay
        controls
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
      >
        브라우저가 비디오 태그를 지원하지 않습니다.
      </video>
    </div>
  );
}