/**
 * Datacap DC Direct Request Builders
 * 
 * Builds XML requests for server communication
 * Based on Datacap Python SDK reference
 */

const datacapConfig = require('../config/datacap');

class DatacapRequestBuilder {
  
  /**
   * Build EMVParamDownload XML request
   * Run on new device install or when processor requests it
   */
  buildEmvParamDownload(sequenceNo, operatorId = 'OPERATOR1', userTrace = 'param_download') {
    return `<?xml version="1.0"?>
<TStream>
    <Admin>
        <MerchantID>${datacapConfig.merchantId}</MerchantID>
        <POSPackageID>${datacapConfig.posPackageId}</POSPackageID>
        <SecureDevice>${datacapConfig.secureDevice}</SecureDevice>
        <TranCode>EMVParamDownload</TranCode>
        <SequenceNo>${sequenceNo}</SequenceNo>
        <TranDeviceID>${datacapConfig.tranDeviceId}</TranDeviceID>
        <OperatorID>${operatorId}</OperatorID>
        <UserTrace>${userTrace}</UserTrace>
    </Admin>
</TStream>`;
  }

  /**
   * Build EMVPadReset XML request
   * Required after every transaction to return device to idle state
   */
  buildEmvPadReset(sequenceNo, operatorId = 'OPERATOR1', userTrace = 'pad_reset') {
    return `<?xml version="1.0"?>
<TStream>
    <Transaction>
        <MerchantID>${datacapConfig.merchantId}</MerchantID>
        <POSPackageID>${datacapConfig.posPackageId}</POSPackageID>
        <SecureDevice>${datacapConfig.secureDevice}</SecureDevice>
        <TranCode>EMVPadReset</TranCode>
        <SequenceNo>${sequenceNo}</SequenceNo>
        <TranDeviceID>${datacapConfig.tranDeviceId}</TranDeviceID>
        <OperatorID>${operatorId}</OperatorID>
        <UserTrace>${userTrace}</UserTrace>
    </Transaction>
</TStream>`;
  }

  /**
   * Build EMVSale XML request
   * Main payment transaction
   */
  buildEmvSale(
    sequenceNo,
    invoiceNo,
    refNo,
    amount,
    requestToken = true,
    okAmount = null,
    operatorId = 'OPERATOR1',
    userTrace = 'sale'
  ) {
    const tokenTags = requestToken ? `
        <RecordNo>RecordNumberRequested</RecordNo>
        <Frequency>Recurring</Frequency>` : '';
    
    const okAmountTag = okAmount ? `\n        <OKAmount>${okAmount}</OKAmount>` : '';
    
    return `<?xml version="1.0"?>
<TStream>
    <Transaction>
        <MerchantID>${datacapConfig.merchantId}</MerchantID>
        <POSPackageID>${datacapConfig.posPackageId}</POSPackageID>
        <SecureDevice>${datacapConfig.secureDevice}</SecureDevice>
        <TranDeviceID>${datacapConfig.tranDeviceId}</TranDeviceID>
        <TranCode>EMVSale</TranCode>
        <InvoiceNo>${invoiceNo}</InvoiceNo>
        <RefNo>${refNo}</RefNo>
        <Amount>
            <Purchase>${amount}</Purchase>
        </Amount>
        <SequenceNo>${sequenceNo}</SequenceNo>
        <PartialAuth>Allow</PartialAuth>${tokenTags}${okAmountTag}
        <OperatorID>${operatorId}</OperatorID>
        <UserTrace>${userTrace}</UserTrace>
    </Transaction>
</TStream>`;
  }

  /**
   * Build VoidSaleByRecordNo XML request
   * Refund/void using token from original sale
   */
  buildVoidSaleByRecordNo(
    sequenceNo,
    invoiceNo,
    refNo,
    amount,
    recordNo,
    authCode,
    acqRefData,
    processData,
    operatorId = 'OPERATOR1',
    userTrace = 'void'
  ) {
    return `<?xml version="1.0"?>
<TStream>
    <Transaction>
        <MerchantID>${datacapConfig.merchantId}</MerchantID>
        <POSPackageID>${datacapConfig.posPackageId}</POSPackageID>
        <SecureDevice>${datacapConfig.secureDevice}</SecureDevice>
        <TranDeviceID>${datacapConfig.tranDeviceId}</TranDeviceID>
        <TranCode>VoidSaleByRecordNo</TranCode>
        <InvoiceNo>${invoiceNo}</InvoiceNo>
        <RefNo>${refNo}</RefNo>
        <TranType>Credit</TranType>
        <Amount>
            <Purchase>${amount}</Purchase>
        </Amount>
        <RecordNo>${recordNo}</RecordNo>
        <AuthCode>${authCode}</AuthCode>
        <AcqRefData>${acqRefData}</AcqRefData>
        <ProcessData>${processData}</ProcessData>
        <SequenceNo>${sequenceNo}</SequenceNo>
        <OperatorID>${operatorId}</OperatorID>
        <UserTrace>${userTrace}</UserTrace>
    </Transaction>
</TStream>`;
  }
}

module.exports = new DatacapRequestBuilder();