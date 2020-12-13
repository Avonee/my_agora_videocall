import React, { useState, useEffect, useReducer } from "react";
import './App.css';
import { Button, Row, Col, Divider, message } from 'antd';
import 'antd/dist/antd.css';
import AgoraRTC from 'agora-rtc-sdk'
import StreamPlayer from 'agora-stream-player'

const defaultState = {
  appId: 'b2ed439ac808478b9db12acdba74ec05',//"",
  channel: 'myChannel',//"",
  uid: "",
  token: '006b2ed439ac808478b9db12acdba74ec05IACBWmV7qXJRQ6fJOozWmptArwKTTnBKh057zcETtG7xtUOQEggAAAAAEABC9EaC1S/XXwEAAQDVL9df',//undefined,
  cameraId: "",
  microphoneId: "",
  mode: "rtc", // 一对一或多人通话中。另外互動直播才用 'live'
  codec: "vp8" // 需要使用 Safari 12.1 及之前版本，将该参数设为 "h264"；其他情况推荐设为 "vp8"。
};

// const reducer = (
//   state: typeof defaultState,
//   action: { type: string;[propName: string]: any }
// ) => {
const reducer = (state, action) => {
  switch (action.type) {
    default:
      return state;
    case "setAppId":
      return {
        ...state,
        appId: action.value
      };
    case "setChannel":
      return {
        ...state,
        channel: action.value
      };
    case "setUid":
      return {
        ...state,
        uid: action.value
      };
    case "setToken":
      return {
        ...state,
        token: action.value
      };
    case "setCamera":
      return {
        ...state,
        cameraId: action.value
      };
    case "setMicrophone":
      return {
        ...state,
        microphoneId: action.value
      };
    case "setMode":
      return {
        ...state,
        mode: action.value
      };
    case "setCodec":
      return {
        ...state,
        codec: action.value
      };
  }
};

function App() {

  const [isJoined, setisJoined] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [state, dispatch] = useReducer(reducer, defaultState)
  const [agoraClient, setClient] = useState(undefined)

  const [localStream, setLocalStream] = useState(null)
  const [remoteStreamList, setRemoteStreamList] = useState([])

  useEffect(() => {
    // console.log('來useEffect！！！')

    let mounted = true;
    // add when subscribed
    const addRemote = (evt) => {
      // console.log("!!!!addRemote")

      if (!mounted) {
        return;
      }
      const { stream } = evt;
      setRemoteStreamList(streamList => [...streamList, stream]);
    };

    // remove stream
    const removeRemote = (evt) => {
      // console.log("!!!!removeRemote")

      const { stream } = evt;
      if (stream) {
        const id = stream.getId();
        const index = remoteStreamList.findIndex(item => item.getId() === id);
        if (index !== -1) {
          setRemoteStreamList(streamList => {
            streamList.splice(index, 1);
            return streamList;
          });
        }
      }
    };

    // subscribe when added
    const doSub = (evt) => {
      // console.log("!!!!doSub")

      if (!mounted) {
        return;
      }

      if (evt.stream.getId()) {
        agoraClient.subscribe(evt.stream);
      }

    };

    // add when published
    const addLocal = (evt) => {
      // console.log('addLocal:::')
      if (!mounted) {
        return;
      }
      const { stream } = evt;
      const stop = stream.stop;
      const close = stream.close;
      stream.close = (func => () => {
        func()
        setLocalStream(undefined);
      })(close);
      stream.stop = (func => () => {
        func()
        setLocalStream(undefined);
      })(stop);
      setLocalStream(stream)
    };


    if (agoraClient) {
      // console.log('agoraClient,', agoraClient)
      agoraClient.on("stream-published", addLocal);
      agoraClient.on("stream-added", doSub);
      agoraClient.on("stream-subscribed", addRemote);
      agoraClient.on("peer-leave", removeRemote);
      agoraClient.on("stream-removed", removeRemote);
    }

    return () => {
      mounted = false;
      if (agoraClient) {
        // Maintains the list of users based on the various network events.
        agoraClient.gatewayClient.removeEventListener("stream-published", addLocal);
        agoraClient.gatewayClient.removeEventListener("stream-added", doSub);
        agoraClient.gatewayClient.removeEventListener("stream-subscribed", addRemote);
        agoraClient.gatewayClient.removeEventListener("peer-leave", removeRemote);
        agoraClient.gatewayClient.removeEventListener("stream-removed", removeRemote);
      }
    };

  }, [agoraClient, remoteStreamList])

  const joinCall = async () => {

    const client = AgoraRTC.createClient({ mode: state.mode, codec: state.codec })
    setClient(client)
    setIsLoading(true);

    try {
      // const uid = isNaN(Number(state.uid)) ? null : Number(state.uid);

      client.init(state.appId);
      client.join(state.token, state.channel, null, (uid) => {

        // 创建本地媒体流
        const localStream = AgoraRTC.createStream({
          // streamID: uid || 12345,
          video: true,
          audio: true,
          // screen: false // true
        });
        localStream.init(() => {
          // console.log('localStream.init!!!!!')
          setLocalStream(localStream)
          // 播放本地流
          // localStream.play("me");
          client.publish(localStream, function (res) {
            console.log('err!!!!!!', res)
          });
          // console.log('client.publish(localStream)!!!!')
        });

      })

      // Set the state appropriately
      setIsPublished(true);
      setisJoined(true);
      message.success(`Joined channel ${state.channel}`, 2.5);
    } catch (err) {
      message.error(`Failed to join, ${err}`, 2.5);
    } finally {
      setIsLoading(false);
    }

  }

  const leaveCall = async () => {
    setIsLoading(true);

    try {
      if (localStream) {
        // Closes the local stream. This de-allocates the resources and turns off the camera light
        localStream.close();
        // unpublish the stream from the client
        agoraClient.unpublish(localStream);
        setLocalStream(undefined)
      }

      // leave the channel
      await agoraClient.leave();
      setRemoteStreamList([])
      setIsPublished(false);
      setisJoined(false);
      message.success(`Left channel ${state.channel}`, 2.5);
    } catch (err) {
      message.error(`Failed to leave, ${err}`, 2.5);
    } finally {
      setIsLoading(false);
    }
  };

  // Publish function to publish the stream to Agora. No need to invoke this after join.
  // This is to be invoke only after an unpublish
  const publish = async () => {
    setIsLoading(true);
    try {
      if (localStream) {
        // Publish the stream to the channel.
        await agoraClient.publish(localStream);
        setIsPublished(true);
      }
      message.success(`Stream published ${state.channel}`, 2.5);
    } catch (err) {
      message.error(`Failed to publish, ${err}`, 2.5);
    } finally {
      setIsLoading(false);
    }
  };

  const unpublish = () => {
    if (localStream) {
      // unpublish the stream from the client
      agoraClient.unpublish(localStream);
      setIsPublished(false);
      message.success(`Stream unpublished ${state.channel}`, 2.5);
    }
  };


  return (
    <div className="App">
      <header className="App-header">
        <p>
          Join as guest
        </p>
        <Divider style={{ background: 'salmon', 'margin-top': '-1%' }}></Divider>
        <Row justify="space-around" align="middle" gutter={20} style={{}}>

          <Col className="gutter-row" flex={10} >
            {localStream && (
              <StreamPlayer stream={localStream} fit="contain" label="local" style={{ height: '500px', width: '667px' }} />
            )}
          </Col>
          <Col className="gutter-row-remote" flex={1} style={{}}>
            {/* {console.log("remoteStreamList!!!!!!", remoteStreamList)} */}
            {(remoteStreamList[0]) && remoteStreamList.map((stream) => (
              <Row gutter={[0, 24]}>
                <Col span={26}>
                  <StreamPlayer
                    key={stream.getId()}
                    stream={stream}
                    fit="contain"
                    // label={stream.getId()}
                    style={{ transform: "rotateY(180deg)" }}
                  />
                  <label style={{ 'font-weight': '900', 'font-size': 'small', position: 'absolute', left: 0, right: 0, bottom: '10px' }}>{stream.getId()}</label>
                </Col>
              </Row>
            ))}
          </Col>

        </Row>
        <Divider></Divider>

        <Row gutter={16}>
          <Col className="gutter-row" span={12}>
            {isJoined ? <Button type="primary" danger
              onClick={leaveCall}
              disabled={isLoading}
              style={{ 'border-radius': '20px' }}
            >
              Leave
        </Button> : <Button ghost
                onClick={joinCall}
                disabled={isLoading}
                style={{ 'border-radius': '20px' }}
              >
                Join
        </Button>}
          </Col>
          <Col className="gutter-row" span={12}>
            {isPublished ? <Button type="primary" danger
              onClick={unpublish}
              disabled={!isJoined || isLoading}
              style={{ 'border-radius': '20px' }}
            >
              Unpublish
        </Button> : <Button ghost
                onClick={publish}
                disabled={!isJoined || isLoading}
                style={{ 'border-radius': '20px' }}
              >
                Publish
        </Button>}
          </Col>
        </Row>
      </header>
    </div >
  );
}

export default App;