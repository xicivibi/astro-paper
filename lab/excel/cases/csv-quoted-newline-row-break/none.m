Table.PromoteHeaders(Csv.Document(File.Contents("{{SOURCE_CSV}}"),[Delimiter=",",Encoding=65001,QuoteStyle=QuoteStyle.None]),[PromoteAllScalars=true])
