import React from "react"
import { QRCodeSVG } from "qrcode.react"

type Props = {
  name: string
}

const QRCode: React.FC<Props> = ({ name }) => {
  return (
    <div className="tunio-visualizer-qr-container">
      <QRCodeSVG value={`https://app.tunio.ai/ru/stream/${name}`} bgColor="transparent" fgColor="white" size={256} />
    </div>
  )
}

export default QRCode
